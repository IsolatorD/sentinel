#!/usr/bin/env bash
# Actualiza Sentinel en el servidor: descarga la última versión, hace una copia de seguridad, reconstruye,
# aplica las migraciones, reinicia y espera a que la API esté sana.
#   ./deploy/deploy.sh              # lo habitual
#   ./deploy/deploy.sh --no-pull    # reconstruir lo que ya hay descargado
#   ./deploy/deploy.sh --no-backup  # sin copia previa (no lo hagas salvo que sepas por qué)
#
# Las imágenes se construyen de una en una (COMPOSE_PARALLEL_LIMIT=1): en una máquina de 2 GB, compilar
# todo a la vez agota la memoria y deja la web lenta mientras dura.
set -euo pipefail

main() {
	cd "$(dirname "$0")/.."
	local env_file="${ENV_FILE:-.env.production}"
	local pull=true backup=true
	for arg in "$@"; do
		case "$arg" in
		--no-pull) pull=false ;;
		--no-backup) backup=false ;;
		*) echo "Opción desconocida: $arg" >&2; exit 1 ;;
		esac
	done
	dc() { docker compose --env-file "$env_file" -f docker-compose.prod.yml "$@"; }

	[ -f "$env_file" ] || { echo "Falta $env_file (créalo con ./deploy/gen-env.sh)." >&2; exit 1; }

	# Poca memoria y sin swap: la construcción puede matar procesos. Mejor avisar antes.
	if command -v free >/dev/null; then
		local mem_mb swap_mb
		mem_mb="$(free -m | awk '/^Mem:/{print $2}')"
		swap_mb="$(free -m | awk '/^Swap:/{print $2}')"
		if [ "$mem_mb" -lt 3000 ] && [ "$swap_mb" -lt 1000 ]; then
			echo "AVISO: ${mem_mb} MB de RAM y ${swap_mb} MB de swap. Añade un archivo de swap de 2 GB (ver README) antes de construir." >&2
		fi
	fi

	if [ "$pull" = true ]; then
		echo "• Descargando la última versión..."
		git pull --ff-only
	fi

	if [ "$backup" = true ] && [ -n "$(dc ps -q postgres 2>/dev/null)" ]; then
		echo "• Copia de seguridad previa..."
		./deploy/backup.sh
	fi

	echo "• Construyendo (de una imagen en una)..."
	COMPOSE_PARALLEL_LIMIT=1 dc build

	echo "• Reiniciando..."
	dc up -d

	echo -n "• Esperando a que la API esté sana"
	local api_id status=""
	api_id="$(dc ps -q api)"
	for _ in $(seq 1 90); do
		status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$api_id" 2>/dev/null || echo unknown)"
		[ "$status" = "healthy" ] && break
		echo -n "."
		sleep 2
	done
	echo
	if [ "$status" != "healthy" ]; then
		echo "La API no llegó a estar sana (estado: $status). Mira: docker compose --env-file $env_file -f docker-compose.prod.yml logs --tail 50 api" >&2
		exit 1
	fi

	# Las imágenes de la versión anterior quedan sin etiqueta y ocupan disco.
	docker image prune -f >/dev/null
	dc ps
	echo "Actualizado."
}

main "$@"
exit
