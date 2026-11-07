# lxserver · fnOS 定制版工程包

洛雪音乐（LX Music）服务端 + 网页播放器的飞牛 OS（fnOS）打包工程，含**全部源码、fnOS 骨架、构建脚本**，可直接迁移到其他机器继续开发。

> **来源声明**：本项目是 [XCQ0607/lxserver](https://github.com/XCQ0607/lxserver) **v2.1.9** 的衍生作品（源码副本 + 局部修改 + fnOS 打包适配），上游采用 **Apache-2.0**、版权归原作者 XCQ 所有。本仓库新增的适配层同样以 Apache-2.0 发布，未获上游背书，与洛雪音乐官方无隶属关系。完整的归属、修改文件清单与许可说明见 [NOTICE.md](NOTICE.md)，许可证全文见 [LICENSE](LICENSE)。

| 项 | 值 |
| --- | --- |
| 版本 | 2.1.9 |
| 上游 | [XCQ0607/lxserver](https://github.com/XCQ0607/lxserver)（Apache-2.0） |
| 运行时 | Node.js ≥ 22 |
| 产物 | `lxserver_<ver>_x64_gateway.fpk` / `lxserver_<ver>_arm64_gateway.fpk` |

---

## 1. 目录结构

```
lxserver-dev-2.1.9/
├── src/                    lxserver 源码工程（上游代码 + 本项目定制）
│   ├── src/                服务端 TypeScript 源码
│   │   ├── index.ts        启动入口（含单用户自愈）
│   │   └── server/         路由、鉴权、音源、媒体、任务
│   ├── public/             前端（网页播放器 + 文件管理）
│   │   └── music/          播放器主前端（app.js / index.html / css / js）
│   ├── scripts/            构建辅助（CSS、filemanager、build-hash）
│   ├── config.js           默认配置（部署后会被安装器初始化为用户配置）
│   └── package.json        npm 脚本与依赖
├── fnos/                   fnOS 安装包骨架
│   ├── manifest            应用元信息（名称、版本、端口、平台）
│   ├── cmd/                生命周期脚本 main/install/upgrade/uninstall
│   ├── config/             privilege、resource
│   ├── wizard/install      安装向导（端口、数据目录）
│   ├── app/ui/             桌面图标与入口配置
│   └── gateway.js          统一网关适配层（Unix Socket → 本地 TCP）
├── app-overlay/            打进 app.tgz 的门面文件
│   ├── index.js            服务入口
│   ├── gateway.js          同 fnos/gateway.js
│   └── README-fnOS.txt     随包的用户说明
├── tools/ui-smoke.mjs      移动端 UI 冒烟脚本（puppeteer-core）
├── prepare-app.sh          编译 + 组装 build-<arch>/app
├── build.sh                打 fpk
└── out/                    构建产物（首次构建时创建）
```

`build-x64/`、`build-arm/` 不随包提供：体积大（各约 190 MB，含内置 Node 运行时与原生依赖），且与 CPU 架构绑定，按第 3 节生成即可。

---

## 2. 环境要求

- Node.js ≥ 22、npm ≥ 8.5
- Python 3（`build.sh` 用它替换架构占位符）
- bash、tar、md5sum
- 生产依赖里的 `sharp`、`music-tag-native` 是原生模块，**必须在目标架构上安装**（x64 机器上装的 `node_modules` 不能给 ARM 用）

---

## 3. 构建流程

### 3.1 只改前端（最常见，无需编译）

```bash
# 直接改 src/public/music/ 下的文件
# 本地起服务看效果
cd src && npm ci && npm run build && node index.js
# 浏览器打开 http://127.0.0.1:9527/
```

前端是静态文件，`src/public` 改动后重新打包即生效，不必跑 `tsc`。

### 3.2 改服务端 TypeScript

```bash
cd src
npm ci                      # 首次
npx tsc -p tsconfig.json    # 编译到 src/server/
npx tsc-alias -p tsconfig.json
node scripts/update-build-hash.js   # 刷新前端缓存哈希，别漏
node index.js               # 启动，默认 9527
```

### 3.3 打 fnOS 安装包

```bash
./prepare-app.sh x64        # 编译 + 组装 build-x64/app
./build.sh x64              # → out/lxserver_2.1.9_x64_gateway.fpk
./build.sh both             # 两个架构一起（需先各自 prepare）
```

首次 `prepare-app.sh` 会在 `build-<arch>/app` 里执行 `npm ci --omit=dev` 安装生产依赖，需要联网。

**内置 Node 运行时**：`app/node` 缺失时脚本会告警，打出的包在 fnOS 上起不来。补法二选一：

```bash
# 从已发布的 fpk 里取（推荐，版本完全一致）
tar xzf lxserver_2.1.9_x64_gateway.fpk -C /tmp/x
tar xzf /tmp/x/app.tgz -C /tmp/x/app
cp -a /tmp/x/app/node build-x64/app/node

# 或指定本机 node 安装目录
NODE_DIST=/usr/local/node ./prepare-app.sh x64
```

---

## 4. fnOS 包结构

fpk 本质是 tar.gz，根目录含 `manifest` + `app.tgz` + `cmd/`、`config/`、`wizard/`、图标。

| 文件 | 作用 |
| --- | --- |
| `manifest` | 应用元信息；`checksum` 必须是 `app.tgz` 的 md5 |
| `cmd/install_init` | 安装前检查；架构白名单在构建期按包架构生成 |
| `cmd/install_callback` | 安装后初始化配置、校正单用户开关 |
| `cmd/upgrade_callback` | 升级时备份并校正配置 |
| `cmd/main` | `start` / `stop` / `status`，负责拉起 Node 与网关进程 |
| `app.tgz` | 应用目录：`index.js`、`server/`、`public/`、`ui/`、`gateway.js`、`node/`、`node_modules/` |
| `app/ui/config` | 桌面入口，`gatewayPrefix=/app/lxserver`、`gatewaySocket=app.sock` |

**网关机制**：飞牛桌面走 HTTPS，若入口用 `http://NAS:端口` 内嵌会被浏览器按混合内容拦截（白屏）。所以 `gateway.js` 同时监听 `app.sock`，网关把 `/app/lxserver/...` 原样转发过来，由它剥前缀转发到 `127.0.0.1:9527`，回写时再给前端绝对路径补前缀。直连端口不受影响。

数据与日志：

```
/var/apps/lxserver/var/app.log     运行日志
/var/apps/lxserver/var/logs/       服务端日志
/var/apps/lxserver/var/data/       用户数据（音源、歌单状态）
```

---

## 5. 本次定制改动清单

### 服务端

| 文件 | 改动 | 解决的问题 |
| --- | --- | --- |
| `src/index.ts` | 启动时若 `ui.singleUser` 为真，强制 `user.enablePublicRestriction=false`、`player.enableAuth=false` 并落盘 | 升级上来的旧配置仍要求登录 |
| `src/server/server.ts` | 请求入口统一身份：单用户下 `x-frontend-auth` 补成 `admin.password`，游客/任意用户名按 `users[0]` 处理；`verifyUserAuth()` 无 token 或 token 无效均返回唯一用户；`/api/login` 任意密码放行，OPTIONS 预检放行 | 单用户仍弹登录、残留 token 报「登录已失效」 |
| `src/server/sources/customSourceHandlers.ts` | 新增 `resolveOwnerName()`，单用户下所有 owner 归一为主用户（`open` 除外），全部调用点改用它 | 电脑加的音源手机看不到 |
| `src/server/sources/userApi.ts` | `initUserApis()` 启动时把各旧账号目录下的音源清单/脚本/状态/排序归并到主用户，原清单改名 `sources.json.merged-<时间戳>` | 旧账号的源在新版本不可见 |

### 前端（`src/public/music/`）

| 文件 | 改动 |
| --- | --- |
| `js/ui/gateway_base.js`（新增） | 最早阶段给 `/api`、`/music`、`/js` 等自有路径补 `/app/lxserver` 前缀，覆盖 `fetch`/`XHR`/`EventSource`/`audio.src`；暴露 `window.__lxGatewayPrefix` |
| `js/ui/common_ui.js` | `goToAdmin()` 拼接网关前缀；`checkProjectAgreement()` 直接放行；`sortSearchResults()` 重写为按搜索意图分权（歌手命中优先），单字歌手降权 |
| `app.js` | `applySingleUserMode()` 隐藏同步/账号/token 区块，默认入口固定 search；搜索结果行拆出 `.song-row-sub`（歌手 + 专辑 + 音质标签）；HTTPS 页面下的 HTTP 音频强制走同源代理；`restorePlaybackSession()` 单用户直接返回 |
| `js/library/leaderboard_manager.js` | 排行榜行同样输出歌手/专辑副行 |
| `index.html` | 引入 `gateway_base.js`（必须在 `config.js` 之前）；缓存/下载目录输入框；隐藏默认入口卡片 |
| `css/mobile.css` | 列表副行排版、详情页封面 `min(66vw,34vh)` 正方形、控制区 5 等分网格、详情态隐藏底栏 |
| `js/ui/mobile_shell.js` | 详情态改用几何检测（高度 > 60% 视口）+ 400ms 轮询兜底，修 `is-detail-open` 漏判 |

### fnOS 骨架

| 文件 | 改动 |
| --- | --- |
| `fnos/cmd/main` | `find_app_pid()` 按 `readlink -f` + cmdline 反查真实进程；启动后连续 5 秒判定才报失败；端口被占时只清理本应用旧实例 |
| `fnos/cmd/install_callback`、`upgrade_callback` | 就地校正 `ui.singleUser` / `enablePublicRestriction` / `enableAuth`，备份 `config.js.bak-<ts>` |
| `fnos/gateway.js` | 301 响应 `Location` 补前缀；静态资源路径回写 |

---

## 6. 排障

| 现象 | 排查 |
| --- | --- |
| 桌面点开白屏 | 看 `var/app.log` 是否有网关启动失败；确认 `app/gateway.js` 存在且 `app.sock` 可写 |
| 页面能开、播放报「无法加载」 | F12 → Network 看 `/api/...` 是否 404：说明前缀没补上，检查 `gateway_base.js` 是否被 `index.html` 正确引入（且排在 config.js 之前） |
| 改完前端不生效 | 前端带 build-hash 与 Service Worker；重新执行 `update-build-hash.js`，浏览器 Ctrl+F5，必要时清站点数据 |
| 「服务启动失败」但实际在跑 | 旧版 fork 后立即校验进程导致误判；现版用 5 秒容忍 + 反查 |
| 卸载后重装提示端口占用 | 残留进程 cwd 已删除；`cmd/main` 会按端口反查并只杀本应用的 `node index.js` |
| 单用户仍要账号密码 | 确认 `ui.singleUser=true`；服务端启动会自愈，仍不行看 `app.log` 是否加载了错误的 config |

UI 冒烟：

```bash
npm i -D puppeteer-core
CHROME=/usr/bin/chromium node tools/ui-smoke.mjs http://NAS:9527/ shots
```

输出首页/搜索截图、单用户区块可见性、JS 错误列表。

---

## 7. 注意

- `src/config.js` 里是**示例配置**（`admin.password=123456`），部署前务必改掉，别把本文件当生产配置。
- 打包前确认 `fnos/manifest` 的 `version` 与 `src/package.json` 一致；`build.sh` 读的是后者。
- 升级包会保留用户数据目录，但 `app.tgz` 内的 `config.js` 会覆盖代码目录里的默认配置，用户实际配置在 `var/data`，勿手动删。
- 上游代码本身的文档见 `src/README.md`、`src/docs/`。
