#!/usr/bin/env bash
# Copia de seguridad de la base de datos (Postgres) en `backups/`, con rotación.
#   ./deploy/backup.sh
#
# Guarda un volcado comprimido `backups/sentinel-AAAAMMDDTHHMMSSZ.dump`, comprueba que se puede leer y
# conserva los últimos KEEP_DAILY (7) y uno por semana de las KEEP_WEEKLY (4) semanas anteriores.
# Redis no se copia: solo guarda colas de trabajo en tránsito, no datos que importen.
#
# Variables opcionales: BACKUP_DIR, KEEP_DAILY, KEEP_WEEKLY, ENV_FILE, y BACKUP_RCLONE_REMOTE
# (por ejemplo `b2:mi-bucket/sentinel`) para subir además cada copia a otro sitio con rclone: una
# copia que vive en la misma máquina no te protege si la máquina desaparece.
set -euo pipefail

cd "$(dirname "$0")/.."
env_file="${ENV_FILE:-.env.production}"
dir="${BACKUP_DIR:-backups}"
keep_daily="${KEEP_DAILY:-7}"
keep_weekly="${KEEP_WEEKLY:-4}"

dc() { docker compose --env-file "$env_file" -f docker-compose.prod.yml "$@"; }

mkdir -p "$dir"
chmod 700 "$dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$dir/sentinel-$stamp.dump"
partial="$file.partial"
trap 'rm -f "$partial"' EXIT

# Formato "custom" de pg_dump: comprimido y restaurable por partes con pg_restore.
dc exec -T postgres pg_dump -U sentinel -Fc sentinel >"$partial"

# Un volcado que no se puede leer no sirve: se descarta antes de borrar copias viejas.
if ! dc exec -T postgres pg_restore --list <"$partial" >/dev/null; then
	echo "La copia no es legible; se descarta." >&2
	exit 1
fi
mv "$partial" "$file"
chmod 600 "$file"
echo "Copia creada: $file ($(du -h "$file" | cut -f1))"

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
	rclone copy "$file" "$BACKUP_RCLONE_REMOTE" && echo "Subida a $BACKUP_RCLONE_REMOTE"
fi

# Rotación: las más recientes y una por semana de las anteriores.
python3 - "$dir" "$keep_daily" "$keep_weekly" <<'PY'
import datetime, pathlib, sys

directory, keep_daily, keep_weekly = pathlib.Path(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
files = sorted(directory.glob("sentinel-*.dump"), reverse=True)  # el nombre ordena por fecha


def week(path):
    day = datetime.datetime.strptime(path.name[len("sentinel-"):][:15], "%Y%m%dT%H%M%S")
    iso = day.isocalendar()
    return (iso[0], iso[1])


keep = set(files[:keep_daily])
weeks = []
for path in files[keep_daily:]:
    w = week(path)
    if w not in weeks:
        weeks.append(w)
        if len(weeks) <= keep_weekly:
            keep.add(path)  # la más reciente de esa semana
for path in files:
    if path not in keep:
        path.unlink()
        print(f"Borrada la copia antigua {path.name}")
PY
