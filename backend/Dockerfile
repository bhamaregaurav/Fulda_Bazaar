FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        default-mysql-client \
        pkg-config \
        libssl-dev \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app
COPY ./alembic ./alembic
COPY ./seeding_script_db ./seeding_script_db
COPY alembic.ini .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# uploads land here when STORAGE_BACKEND=local
RUN mkdir -p /app/media

ENTRYPOINT ["./entrypoint.sh"]

# entrypoint.sh takes a subcommand: serve | migrate | seed | dev
CMD ["serve"]
