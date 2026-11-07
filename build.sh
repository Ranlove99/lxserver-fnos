#!/usr/bin/env bash
# ============================================================================
# lxserver → fnOS 安装包构建脚本
#
#   用法：./build.sh [x64|arm|both]      默认 both
#
#   输入：build-<arch>/app          （应用运行时目录，由 prepare-app.sh 生成）
#   输出：out/lxserver_<ver>_<arch>_gateway.fpk
#
#   环境变量：
#     VER       覆盖版本号（默认读 src/package.json）
#     OUTDIR    输出目录（默认 ./out）
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-both}"
VER="${VER:-$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/src/package.json" | head -1)}"
OUTDIR="${OUTDIR:-$ROOT/out}"
[ -n "$VER" ] || { echo "无法读取版本号，请用 VER=x.y.z 指定" >&2; exit 1; }
mkdir -p "$OUTDIR"

pak() {
    local ARCH="$1" APPDIR="$2" OUTNAME="$3"
    local STAGE
    STAGE="$(mktemp -d)"
    trap 'rm -rf "$STAGE"' RETURN

    [ -d "$APPDIR" ] || { echo "缺少 $APPDIR，先执行 ./prepare-app.sh $ARCH" >&2; exit 1; }
    [ -f "$APPDIR/server/index.js" ] || { echo "$APPDIR/server/index.js 不存在，服务端未编译" >&2; exit 1; }

    cp -r "$ROOT/fnos/cmd" "$ROOT/fnos/config" "$ROOT/fnos/wizard" \
          "$ROOT/fnos/ICON.PNG" "$ROOT/fnos/ICON_256.PNG" "$STAGE/"

    # install_init 的架构白名单必须在构建期按包架构生成，否则脚本语法错误
    python3 - "$STAGE/cmd/install_init" "$ARCH" <<'PY'
import sys
p, arch = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
if arch == 'arm':
    body = ('  aarch64|arm64) : ;;\n'
            '  *) fail "本安装包仅支持 ARM64（aarch64）架构，当前设备为 ${ARCH}。请下载 x86_64 版本。" ;;\n')
else:
    body = ('  x86_64|amd64) : ;;\n'
            '  *) fail "本安装包仅支持 x86_64 架构，当前设备为 ${ARCH}。请下载 ARM64 版本。" ;;\n')
if '__ARCH_CASE__' not in s:
    sys.exit('构建失败：fnos/cmd/install_init 缺少 __ARCH_CASE__ 占位符')
open(p, 'w', encoding='utf-8').write(s.replace('__ARCH_CASE__\n', body))
PY

    # 门禁：生命周期脚本必须语法正确，残留占位符直接失败
    # （install_callback 里的 s/__PORT__/ 是运行时 sed 模式，不算占位符）
    chmod +x "$STAGE"/cmd/*
    for f in "$STAGE"/cmd/*; do
        bash -n "$f" || { echo "构建失败：$f 语法错误" >&2; exit 1; }
        if grep -qE '^[[:space:]]*__[A-Z_]{2,}__[[:space:]]*$' "$f"; then
            echo "构建失败：$f 残留未替换占位符" >&2; exit 1
        fi
    done

    # app.tgz（不含 ./ 前缀，保持历史包结构）
    ( cd "$APPDIR" && tar czf "$STAGE/app.tgz" * )

    # manifest：替换平台并写入 app.tgz 的 md5
    local SUM
    SUM=$(md5sum "$STAGE/app.tgz" | awk '{print $1}')
    sed "s/__PLATFORM__/$ARCH/" "$ROOT/fnos/manifest" |
        awk -F'=' 'NF>=2{ k=$1; v=substr($0, index($0,"=")+1); sub(/^ +/,"",v); printf "%-27s= %s\n", k, v }' > "$STAGE/manifest"
    printf "%-27s= %s\n" "checksum" "$SUM" >> "$STAGE/manifest"

    ( cd "$STAGE" && tar czf "$OUTDIR/$OUTNAME" . )
    echo "  -> $OUTDIR/$OUTNAME  ($(du -h "$OUTDIR/$OUTNAME" | cut -f1))  md5(app.tgz)=$SUM"
}

chmod +x "$ROOT/fnos/cmd/"* 2>/dev/null || true
echo "版本 $VER"
case "$TARGET" in
    arm)  pak arm "$ROOT/build-arm/app" "lxserver_${VER}_arm64_gateway.fpk" ;;
    x64)  pak x64 "$ROOT/build-x64/app" "lxserver_${VER}_x64_gateway.fpk" ;;
    both) echo "[1/2] ARM"; pak arm "$ROOT/build-arm/app" "lxserver_${VER}_arm64_gateway.fpk"
          echo "[2/2] x86"; pak x64 "$ROOT/build-x64/app" "lxserver_${VER}_x64_gateway.fpk" ;;
    *)    echo "用法：./build.sh [x64|arm|both]" >&2; exit 1 ;;
esac
echo "完成，产物在 $OUTDIR"
