#!/bin/bash
# Usage: entrypoint.sh [serve|migrate|seed|dev]
#
#   serve    (default) wait for the database, then run the app. Touches nothing.
#   migrate  apply committed migrations (alembic upgrade head), then exit.
#   seed     insert dummy data, then exit.
#   dev      LOCAL ONLY - wipes alembic/versions, autogenerates a migration from
#            the models, applies it, seeds, then serves. Never run this against
#            a database you care about.
set -e

CMD="${1:-serve}"
DB_HOST="${DB_HOST:-${MYSQL_HOST:-mysql}}"
DB_PORT="${DB_PORT:-${MYSQL_PORT:-3306}}"

wait_for_db() {
  echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
  tries=0
  until mysql --skip-ssl -h "$DB_HOST" -P "$DB_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
        -e "SELECT 1;" "$MYSQL_DATABASE" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
      echo "ERROR: MySQL still unreachable after 60 attempts; giving up." >&2
      exit 1
    fi
    echo "  MySQL unavailable, retrying (${tries}/60)..."
    sleep 5
  done
  echo "MySQL is up."
}

run_migrations() {
  echo "Applying migrations..."
  alembic upgrade head
}

run_seed() {
  echo "Seeding dummy data..."
  PYTHONPATH=/app python seeding_script_db/add_dummy_data.py
}

serve() {
  echo "Starting application server..."
  exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
}

case "$CMD" in
  serve)
    wait_for_db
    serve
    ;;
  migrate)
    wait_for_db
    run_migrations
    ;;
  seed)
    wait_for_db
    run_seed
    ;;
  dev)
    if [ "${ALLOW_DEV_ENTRYPOINT:-false}" != "true" ]; then
      echo "ERROR: 'dev' rebuilds the schema from scratch and is refused unless" >&2
      echo "       ALLOW_DEV_ENTRYPOINT=true is set. Use 'migrate' + 'serve'." >&2
      exit 1
    fi
    wait_for_db
    echo "DEV MODE: regenerating migrations from models (destructive)"
    rm -rf /app/alembic/versions/*
    alembic revision --autogenerate -m "Create tables"
    run_migrations
    run_seed || true
    serve
    ;;
  *)
    echo "Unknown command '$CMD'. Use: serve | migrate | seed | dev" >&2
    exit 1
    ;;
esac
