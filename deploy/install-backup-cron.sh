#!/usr/bin/env bash
# Programa la copia de seguridad diaria (03:17, hora del servidor) en el cron de tu usuario.
#   ./deploy/install-backup-cron.sh            # instalar (se puede repetir: no duplica)
#   ./deploy/install-backup-cron.sh --remove   # quitar
set -euo pipefail

cd "$(dirname "$0")/.."
repo="$(pwd)"
marker="# sentinel-backup"
line="17 3 * * * cd $repo && ./deploy/backup.sh >> $repo/backups/backup.log 2>&1 $marker"

current="$(crontab -l 2>/dev/null || true)"
without="$(printf '%s\n' "$current" | grep -vF "$marker" || true)"

if [ "${1:-}" = "--remove" ]; then
	printf '%s\n' "$without" | sed '/^$/d' | crontab -
	echo "Copia diaria desactivada."
	exit 0
fi

mkdir -p backups
printf '%s\n%s\n' "$without" "$line" | sed '/^$/d' | crontab -
echo "Copia diaria programada:"
crontab -l | grep -F "$marker"
