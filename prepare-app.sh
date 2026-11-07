#!/usr/bin/env bash
# ============================================================================
# 组装 fnOS 应用目录 build-<arch>/app
#
#   用法：./prepare-app.sh [x64|arm]
#
#   做的事：
#     1. 编译 TypeScript（src → src/server）
#     2. 刷新前端构建哈希（用于缓存失效）
#     3. 把 server / public / ui / 门面文件铺进 build-<arch>/app
#     4. 缺生产依赖时执行 npm ci --omit=dev
#
#   说明：app/node（Node 运行时）与 app/node_modules 里的原生模块
#         （sharp、music-tag-native 等）跟 CPU 架构绑定，必须来自
#         目标架构。脚本不会伪造它们，缺失时给出明确提示。
#
#   环境变量：
#     NODE_DIST   含 node 可执行文件的目录（如 /usr/local/node），拷为 app/node
#     SKIP_BUILD  =1 跳过编译，只重新铺文件
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCH="${1:-x64}"
case "$ARCH" in
    x64|arm) ;;
    *) echo "用法：./prepare-app.sh [x64|arm]" >&2; exit 1 ;;
esac

SRC="$ROOT/src"
APPDIR="$ROOT/build-$ARCH/app"
command -v node >/dev/null || { echo "需要 Node.js >= 22" >&2; exit 1; }

# ---------- 1. 编译 ----------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "[1/4] 编译 TypeScript"
    cd "$SRC"
    [ -d node_modules ] || npm ci
    rm -rf server
    npx tsc -p tsconfig.json
    npx tsc-alias -p tsconfig.json
    node scripts/update-build-hash.js
else
    echo "[1/4] 跳过编译"
fi
[ -f "$SRC/server/index.js" ] || { echo "编译失败：$SRC/server/index.js 未生成" >&2; exit 1; }

# ---------- 2. 铺文件 ----------
echo "[2/4] 组装 $APPDIR"
mkdir -p "$APPDIR"
# 保留既有运行时与依赖，只替换代码
rm -rf "$APPDIR/server" "$APPDIR/public" "$APPDIR/ui"
cp -a "$SRC/server" "$SRC/public" "$APPDIR/"
cp -a "$ROOT/fnos/app/ui" "$APPDIR/ui"
cp -a "$ROOT/app-overlay/." "$APPDIR/"
cp -a "$SRC/package.json" "$SRC/config.js" "$APPDIR/"

# ---------- 3. 生产依赖 ----------
echo "[3/4] 检查生产依赖"
if [ ! -d "$APPDIR/node_modules" ]; then
    cp -a "$SRC/package-lock.json" "$APPDIR/"
    ( cd "$APPDIR" && npm ci --omit=dev )
else
    echo "      app/node_modules 已存在，跳过"
fi

# ---------- 4. Node 运行时 ----------
echo "[4/4] 检查 Node 运行时"
if [ -x "$APPDIR/node/bin/node" ]; then
    echo "      已存在 $( "$APPDIR/node/bin/node" -v )"
elif [ -n "${NODE_DIST:-}" ]; then
    rm -rf "$APPDIR/node"; mkdir -p "$APPDIR/node"
    cp -a "$NODE_DIST/." "$APPDIR/node/"
    echo "      已从 $NODE_DIST 拷入"
else
    echo "  [警告] 缺少 $APPDIR/node/bin/node（内置 Node 运行时）。
         可直接取官方 fpk 里的 app/node，或用 NODE_DIST=<node安装目录> 指定。
         缺它打出的包在 fnOS 上无法启动服务。" >&2
fi

echo "就绪：$APPDIR"
