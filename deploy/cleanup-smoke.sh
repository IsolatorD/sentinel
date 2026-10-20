#!/usr/bin/env bash
# Borra de la base de datos lo que crea deploy/smoke-test.sh (organizaciones `smoke-*` y usuarios
# `smoke-*@example.test`, con todos sus proyectos, issues y eventos). Se ejecuta en el servidor.
#   ./deploy/cleanup-smoke.sh
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
	psql -U sentinel -v ON_ERROR_STOP=1 <<'SQL'
delete from organization where slug like 'smoke-%';
delete from "user" where email like 'smoke-%@example.test';
SQL
