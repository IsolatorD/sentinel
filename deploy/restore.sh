#!/usr/bin/env bash
# Restaura la base de datos desde una copia de `deploy/backup.sh`. SUSTITUYE los datos actuales.
#   ./deploy/restore.sh backups/sentinel-20261020T031700Z.dump
#   ./deploy/restore.sh --yes <archivo>       # sin pedir confirmación
#   ./deploy/restore.sh --latest              # la copia más reciente
#
# Antes de tocar nada hace una copia de seguridad de lo que hay ahora (por si te equivocas de archivo),
# para la API y el worker mientras restaura, y los vuelve a arrancar al terminar.
set -euo pipefail

cd "$(dirname "$0")/.."
env_file="${ENV_FILE:-.env.production}"
dir="${BACKUP_DIR:-backups}"
dc() { docker compose --env-file "$env_file" -f docker-compose.prod.yml "$@"; }

assume_yes=false
file=""
for arg in "$@"; do
	case "$arg" in
	--yes) assume_yes=true ;;
	--latest) file="$(ls -1 "$dir"/sentinel-*.dump 2>/dev/null | sort | tail -1)" ;;
	*) file="$arg" ;;
	esac
done
if [ -z "$file" ] || [ ! -f "$file" ]; then
	echo "Uso: $0 [--yes] <archivo.dump | --latest>   (copias en $dir/)" >&2
	exit 1
fi

if [ "$assume_yes" != true ]; then
	echo "Se va a SUSTITUIR la base de datos actual por: $file"
	read -r -p "Escribe 'restaurar' para continuar: " answer
	[ "$answer" = "restaurar" ] || { echo "Cancelado."; exit 1; }
fi

echo "1/4 Copia de seguridad de lo que hay ahora..."
./deploy/backup.sh

echo "2/4 Parando la API y el worker..."
dc stop api worker

echo "3/4 Restaurando $file ..."
# --clean --if-exists: borra lo que hay antes de crearlo. Sin --no-owner, falla si el rol no existe.
dc exec -T postgres pg_restore -U sentinel -d sentinel --clean --if-exists --no-owner <"$file"

echo "4/4 Arrancando la API y el worker..."
dc up -d api worker
echo "Listo."
