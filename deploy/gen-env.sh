#!/usr/bin/env bash
# Crea `.env.production` con secretos aleatorios a partir de la plantilla.
#   ./deploy/gen-env.sh 203-0-113-10.sslip.io
# No sobrescribe un `.env.production` existente: si ya existe, no toca nada.
set -euo pipefail

cd "$(dirname "$0")/.."
target=".env.production"

if [ -e "$target" ]; then
	echo "$target ya existe; no se modifica." >&2
	exit 1
fi
if [ $# -lt 1 ]; then
	echo "Uso: $0 <dominio>   (por ejemplo 203-0-113-10.sslip.io)" >&2
	exit 1
fi

domain="$1"
# Cadenas hexadecimales: sin caracteres que haya que escapar en una URL o en el .env.
password="$(openssl rand -hex 24)"
secret="$(openssl rand -hex 32)"

umask 077
sed \
	-e "s|^DOMAIN=.*|DOMAIN=${domain}|" \
	-e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${password}|" \
	-e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${secret}|" \
	deploy/.env.production.example >"$target"

echo "Creado $target (permisos 600). Revisa SMTP_URL y SMTP_FROM antes de arrancar."
