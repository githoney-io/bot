#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
ENV_FILE="${BACKEND_DIR}/.env"

CONTAINER_NAME="${PG_CONTAINER_NAME:-githoney-postgres}"
VOLUME_NAME="${PG_VOLUME_NAME:-githoney_postgres_data}"
POSTGRES_IMAGE="${PG_IMAGE:-postgres:16}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found in PATH"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "backend .env not found at ${ENV_FILE}"
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-$(grep '^DATASOURCE_URL=' "${ENV_FILE}" | tail -n1 | cut -d= -f2-)}"
if [[ -z "${DATABASE_URL}" ]]; then
  echo "DATASOURCE_URL is missing (set DATABASE_URL env var or backend/.env)"
  exit 1
fi

# Expected URL format:
# postgresql://user:password@host:port/dbname
URL_NO_PROTO="${DATABASE_URL#postgresql://}"
CREDS_AND_HOST="${URL_NO_PROTO%%/*}"
DB_NAME="${URL_NO_PROTO#*/}"
CREDS="${CREDS_AND_HOST%%@*}"
HOST_AND_PORT="${CREDS_AND_HOST#*@}"
DB_USER="${CREDS%%:*}"
DB_PASSWORD="${CREDS#*:}"
DB_HOST="${HOST_AND_PORT%%:*}"
DB_PORT="${HOST_AND_PORT#*:}"

if [[ "${DB_HOST}" != "localhost" && "${DB_HOST}" != "127.0.0.1" ]]; then
  echo "warning: DATASOURCE_URL host is '${DB_HOST}', script still starts local container"
fi

if [[ -z "${DB_USER}" || -z "${DB_PASSWORD}" || -z "${DB_NAME}" || -z "${DB_PORT}" ]]; then
  echo "failed to parse DATASOURCE_URL='${DATABASE_URL}'"
  exit 1
fi

start_container_with_named_volume() {
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e "POSTGRES_USER=${DB_USER}" \
    -e "POSTGRES_PASSWORD=${DB_PASSWORD}" \
    -e "POSTGRES_DB=${DB_NAME}" \
    -p "${DB_PORT}:5432" \
    -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
    "${POSTGRES_IMAGE}" >/dev/null
}

if docker ps -a --format '{{.Names}}' | rg -x "${CONTAINER_NAME}" >/dev/null 2>&1; then
  CURRENT_DATA_NAME="$(
    docker inspect "${CONTAINER_NAME}" \
      --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}'
  )"
  CURRENT_DATA_TYPE="$(
    docker inspect "${CONTAINER_NAME}" \
      --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}{{end}}{{end}}'
  )"
  CURRENT_DATA_SOURCE="$(
    docker inspect "${CONTAINER_NAME}" \
      --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}'
  )"

  if [[ "${CURRENT_DATA_NAME}" != "${VOLUME_NAME}" ]]; then
    echo "migrating postgres data to named volume '${VOLUME_NAME}' (current mount: '${CURRENT_DATA_NAME:-${CURRENT_DATA_SOURCE}}')"
    docker volume create "${VOLUME_NAME}" >/dev/null

    FROM_SPEC=""
    if [[ "${CURRENT_DATA_TYPE}" == "volume" && -n "${CURRENT_DATA_NAME}" ]]; then
      FROM_SPEC="${CURRENT_DATA_NAME}:/from:ro"
    elif [[ -n "${CURRENT_DATA_SOURCE}" ]]; then
      FROM_SPEC="${CURRENT_DATA_SOURCE}:/from:ro"
    else
      echo "could not resolve current postgres data mount; refusing to recreate container"
      exit 1
    fi

    STATUS="$(docker inspect -f '{{.State.Status}}' "${CONTAINER_NAME}")"
    if [[ "${STATUS}" == "running" ]]; then
      docker stop "${CONTAINER_NAME}" >/dev/null
    fi

    docker run --rm -v "${FROM_SPEC}" -v "${VOLUME_NAME}:/to" alpine:3.20 \
      sh -c "cp -a /from/. /to/" >/dev/null

    docker rm "${CONTAINER_NAME}" >/dev/null
    start_container_with_named_volume
    echo "container recreated with named volume '${VOLUME_NAME}'"
  fi

  STATUS="$(docker inspect -f '{{.State.Status}}' "${CONTAINER_NAME}")"
  if [[ "${STATUS}" != "running" ]]; then
    echo "starting existing postgres container '${CONTAINER_NAME}'"
    docker start "${CONTAINER_NAME}" >/dev/null
  else
    echo "postgres container '${CONTAINER_NAME}' already running"
  fi
else
  echo "creating postgres container '${CONTAINER_NAME}' with persistent volume '${VOLUME_NAME}'"
  start_container_with_named_volume
fi

echo "waiting for postgres readiness..."
for _ in $(seq 1 60); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d postgres >/dev/null 2>&1; then
  echo "postgres did not become ready in time"
  exit 1
fi

DB_EXISTS="$(
  docker exec -e "PGPASSWORD=${DB_PASSWORD}" "${CONTAINER_NAME}" \
    psql -U "${DB_USER}" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" \
    | tr -d '[:space:]'
)"

if [[ "${DB_EXISTS}" != "1" ]]; then
  echo "creating database '${DB_NAME}'"
  docker exec -e "PGPASSWORD=${DB_PASSWORD}" "${CONTAINER_NAME}" \
    psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};" >/dev/null
fi

echo "running backend migrations"
(cd "${BACKEND_DIR}" && npm run migrate)

echo "seeding required reference rows"
docker exec -i -e "PGPASSWORD=${DB_PASSWORD}" "${CONTAINER_NAME}" \
  psql -U "${DB_USER}" -d "${DB_NAME}" <<'SQL'
INSERT INTO platform(name)
VALUES ('github')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role(name)
VALUES ('maintainer'), ('contributor'), ('sponsor')
ON CONFLICT (name) DO NOTHING;

INSERT INTO bounty_status(status)
VALUES ('open'), ('assigned'), ('completed'), ('claimed'), ('closed')
ON CONFLICT (status) DO NOTHING;

INSERT INTO submission_status(status)
VALUES ('assigned'), ('accepted'), ('rejected')
ON CONFLICT (status) DO NOTHING;

INSERT INTO command_error_type(name)
VALUES
  ('EMPTY_COMMAND'),
  ('BAD_COMMAND_SYNTAX'),
  ('NO_ARGS'),
  ('INVALID_ARG_VALUE'),
  ('USER_INSTALLATION')
ON CONFLICT (name) DO NOTHING;

INSERT INTO network(name, is_mainnet, description)
SELECT 'mainnet', true, 'Cardano Mainnet'
WHERE NOT EXISTS (SELECT 1 FROM network WHERE name = 'mainnet');

INSERT INTO network(name, is_mainnet, description)
SELECT 'preprod', false, 'Cardano Testnet'
WHERE NOT EXISTS (SELECT 1 FROM network WHERE name = 'preprod');

INSERT INTO currency(ticker, name, logo_uri)
VALUES
  ('ADA', 'ADA', 'https://cardano.org/img/brand-assets/cardano-starburst-blue.svg'),
  ('tokenA', 'tokenA', 'https://cardano.org/img/brand-assets/cardano-starburst-blue.svg'),
  ('tokenB', 'tokenB', 'https://cardano.org/img/brand-assets/cardano-starburst-blue.svg'),
  ('tokenC', 'tokenC', 'https://cardano.org/img/brand-assets/cardano-starburst-blue.svg')
ON CONFLICT (ticker)
DO UPDATE SET
  name = EXCLUDED.name,
  logo_uri = EXCLUDED.logo_uri;
SQL

echo "reference row counts:"
docker exec -e "PGPASSWORD=${DB_PASSWORD}" "${CONTAINER_NAME}" \
  psql -U "${DB_USER}" -d "${DB_NAME}" -c \
  "select 'platform' as t,count(*) from platform
   union all select 'role',count(*) from role
   union all select 'bounty_status',count(*) from bounty_status
   union all select 'submission_status',count(*) from submission_status
   union all select 'network',count(*) from network
   union all select 'currency',count(*) from currency;"

echo "done."
echo "persistent postgres volume: ${VOLUME_NAME}"
