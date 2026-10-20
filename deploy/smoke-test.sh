#!/usr/bin/env bash
# Prueba de humo contra una instancia desplegada: salud, web, registro, un error enviado como lo haría
# una SDK y su aparición como issue. Crea una cuenta de prueba (smoke-...@example.test).
#   ./deploy/smoke-test.sh https://203-0-113-10.sslip.io
# Con un certificado autofirmado (p. ej. https://localhost) añade -k:  CURL_OPTS=-k ./deploy/smoke-test.sh ...
set -euo pipefail

base="${1:?Uso: $0 <https://dominio>}"
base="${base%/}"
opts=(${CURL_OPTS:-})
jar="$(mktemp)"
trap 'rm -f "$jar"' EXIT

step() { printf '• %s ... ' "$1"; }
ok() { echo "ok"; }
fail() { echo "FALLÓ: $1" >&2; exit 1; }

call() { # método ruta [cuerpo-json] -> imprime el cuerpo; falla si no es 2xx
	local method="$1" path="$2" body="${3:-}"
	local args=(-sS "${opts[@]}" -b "$jar" -c "$jar" -X "$method" -H "Origin: $base" -w '\n%{http_code}')
	[ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
	local out code
	out="$(curl "${args[@]}" "$base$path")"
	code="${out##*$'\n'}"
	[[ "$code" =~ ^2 ]] || fail "$method $path -> $code: ${out%$'\n'*}"
	printf '%s' "${out%$'\n'*}"
}

# Lee un valor de un JSON por stdin (python3 viene con Ubuntu; el servidor no necesita Node).
json() { python3 -c 'import json,sys; v=json.load(sys.stdin); print(eval("v"+sys.argv[1]))' "$1"; }

step "salud de la API"
call GET /api/health >/dev/null && ok

step "la web responde (y el enrutado del cliente cae en index.html)"
curl -sS "${opts[@]}" "$base/" | grep -qi '<div id="root"' || fail "no parece la web de Sentinel"
curl -sS "${opts[@]}" "$base/ruta/que/no/existe" | grep -qi '<div id="root"' || fail "falta el fallback a index.html"
ok

email="smoke-$(date +%s)@example.test"
step "registro ($email)"
call POST /api/auth/sign-up/email "{\"name\":\"Smoke\",\"email\":\"$email\",\"password\":\"smoke-password-123\"}" >/dev/null && ok

step "organización y proyecto"
slug="smoke-$(date +%s)"
org="$(call POST /api/auth/organization/create "{\"name\":\"Smoke\",\"slug\":\"$slug\"}" | json "['id']")"
project="$(call POST "/api/organizations/$org/projects" '{"name":"Smoke app"}')"
project_id="$(printf '%s' "$project" | json "['id']")"
key="$(printf '%s' "$project" | json "['keys'][0]['publicKey']")"
ok

step "ingesta de un error"
curl -sS "${opts[@]}" -o /dev/null -w '%{http_code}' -X POST "$base/api/$project_id/events" \
	-H "X-Sentinel-Key: $key" -H 'Content-Type: application/json' \
	-d '{"level":"error","release":"1.0.0","environment":"smoke","exception":{"values":[{"type":"SmokeError","value":"hello from the smoke test","stacktrace":{"frames":[{"filename":"app.js","function":"main","lineno":1,"in_app":true}]}}]}}' \
	| grep -q '^202$' || fail "la ingesta no respondió 202"
ok

step "el worker lo convierte en issue"
for _ in $(seq 1 30); do
	total="$(call GET "/api/organizations/$org/projects/$project_id/issues?status=all" | json "['total']")"
	[ "$total" = "1" ] && break
	sleep 1
done
[ "$total" = "1" ] || fail "el issue no apareció en 30 s (¿el worker está en marcha?)"
ok

echo "Todo bien: $base"
echo "(Crea datos de prueba; en el servidor, ./deploy/cleanup-smoke.sh los borra.)"
