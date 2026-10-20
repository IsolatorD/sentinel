#!/usr/bin/env bash
# Empaqueta las SDK y la CLI como archivos instalables, con nombres SIN versión para que una URL
# estable (`.../sdk/sentinel-browser.tgz`) sirva siempre la última:
#   sentinel-browser.tgz  sentinel-react.tgz  sentinel-node.tgz  sentinel-react-native.tgz
#   sentinel-cli.tgz      sentinel-sdk.tar.gz (Python)           sentinel.min.js (navegador, <script>)
#
#   pnpm build && ./scripts/pack-sdks.sh [directorio-de-salida]     # por defecto: sdk-dist/
#
# Lo usan el Dockerfile (la instancia sirve los archivos en /sdk/) y el workflow de las Releases.
# Cada paquete JS es autosuficiente: `@sentinel/core` y `@sentinel/shared` van dentro (también sus tipos).
set -euo pipefail

cd "$(dirname "$0")/.."
out="${1:-sdk-dist}"
rm -rf "$out"
mkdir -p "$out"
out="$(cd "$out" && pwd)"

pack() { # nombre-del-paquete archivo-de-salida
	local dir
	dir="$(mktemp -d)"
	pnpm --filter "$1" pack --pack-destination "$dir" >/dev/null
	mv "$dir"/*.tgz "$out/$2"
	rmdir "$dir"
	echo "  $2"
}

echo "Empaquetando en $out"
pack @sentinel/browser sentinel-browser.tgz
pack @sentinel/react sentinel-react.tgz
pack @sentinel/node sentinel-node.tgz
pack @sentinel/react-native sentinel-react-native.tgz
pack @sentinel/cli sentinel-cli.tgz

# <script src>: el bundle minificado del navegador.
cp packages/sdk-browser/dist/sentinel.min.js "$out/sentinel.min.js"
echo "  sentinel.min.js"

# Python: el código fuente (sin pruebas ni cachés) en un archivo que `pip install <url>` construye solo.
version="$(sed -n 's/^version = "\(.*\)"/\1/p' packages/sdk-python/pyproject.toml | head -1)"
stage="$(mktemp -d)"
root="$stage/sentinel-sdk-$version"
mkdir -p "$root"
cp packages/sdk-python/pyproject.toml packages/sdk-python/README.md "$root/"
cp LICENSE "$root/"
cp -R packages/sdk-python/src "$root/src"
find "$root" -name '__pycache__' -type d -prune -exec rm -rf {} +
find "$root" -name '*.egg-info' -type d -prune -exec rm -rf {} +
# COPYFILE_DISABLE: en macOS evita los archivos `._*` que rompen la detección de la carpeta raíz en pip.
COPYFILE_DISABLE=1 tar -C "$stage" -czf "$out/sentinel-sdk.tar.gz" "sentinel-sdk-$version"
rm -rf "$stage"
echo "  sentinel-sdk.tar.gz (Python $version)"
