# 来源声明 / Attribution

本仓库是 **[XCQ0607/lxserver](https://github.com/XCQ0607/lxserver)** 的**衍生作品**（源码副本 + 局部修改 + 打包适配），并非原创项目，也未获得上游作者背书。

| 项 | 说明 |
| --- | --- |
| 上游项目 | LX Music Sync Server (Enhanced Edition) |
| 上游仓库 | https://github.com/XCQ0607/lxserver |
| 上游版本 | 2.1.9 |
| 上游作者 | XCQ（见上游 `package.json` 的 `author` 字段） |
| 上游许可证 | Apache License 2.0（[原文](https://www.apache.org/licenses/LICENSE-2.0)，副本见本仓库 `LICENSE` 与 `src/LICENSE`） |
| 本仓库用途 | 把上游服务端与网页播放器打包为飞牛 OS（fnOS）应用，并修复若干使用问题 |

## 内容归属

| 路径 | 来源 |
| --- | --- |
| `src/` | 上游源码副本，其中部分文件**已修改**（清单见 `README.md` 第 5 节） |
| `fnos/`、`app-overlay/` | 本仓库新增：fnOS 安装包骨架、生命周期脚本、统一网关适配层、桌面入口 |
| `build.sh`、`prepare-app.sh` | 本仓库新增：编译与打包脚本 |
| `tools/`、`README.md`、`NOTICE.md` | 本仓库新增：开发辅助与文档 |
| `LICENSE` | 上游 `src/LICENSE` 的副本（Apache-2.0 全文） |

## 修改声明

按 Apache-2.0 第 4 条，以下上游文件已被修改，具体改动与原因见 `README.md` 第 5 节：

- `src/src/index.ts`
- `src/src/server/server.ts`
- `src/src/server/sources/customSourceHandlers.ts`
- `src/src/server/sources/userApi.ts`
- `src/public/music/app.js`
- `src/public/music/index.html`
- `src/public/music/css/mobile.css`
- `src/public/music/js/ui/common_ui.js`
- `src/public/music/js/ui/mobile_shell.js`
- `src/public/music/js/library/leaderboard_manager.js`
- 以及新增的 `src/public/music/js/ui/gateway_base.js`

上游原有的版权、许可与归属声明均予以保留；上游 `src/notice/notification.json` 亦原样保留。

## 许可与商标

- 本仓库新增的适配层、脚本与文档同样以 **Apache License 2.0** 发布。
- “洛雪音乐 / LX Music” 及其相关标识归其各自权利人所有。本仓库仅为第三方打包适配，与上游作者及洛雪音乐项目无隶属、授权或背书关系。
- 本仓库不包含任何音源、音乐文件；用户需自行遵守所在地区的法律法规与音源服务条款。
