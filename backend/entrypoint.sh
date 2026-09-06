#!/bin/bash
set -e

echo "⏳ Waiting for MySQL to be ready..."

# Wait until MySQL is ready
until mysql --skip-ssl -h mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1;" "$MYSQL_DATABASE"; do
  >&2 echo "MySQL is unavailable - sleeping"
  sleep 15
done

echo "✅ MySQL is up and running!"

# Clean versions folder
echo "🧹 Cleaning alembic versions..."
rm -rf /app/alembic/versions/*

# Generate Alembic migration
echo "⚙️ Generating new alembic migration..."
alembic revision --autogenerate -m "Create tables"

# Apply migrations
echo "🚀 Applying migrations..."
alembic upgrade head

# Run seed script
echo "🌱 Running seed script..."
PYTHONPATH=/app python seeding_script_db/add_dummy_data.py || true

# Start the app
echo "🚦 Starting application server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
