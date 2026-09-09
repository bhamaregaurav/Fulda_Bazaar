# Fulda Bazaar

A student marketplace and language-exchange platform. Users can post and browse
listings, save them to a watchlist, chat in real time, complete transactions with
ratings, and get matched with a language partner for a video session.

Built as a team project for the *Global Distributed Software Development* course
(Summer 2025, Hochschule Fulda).

## Features

- JWT authentication with optional TOTP two-factor auth
- Listings with image upload, categories, geospatial search and filtering
- Watchlist
- Real-time messaging over WebSockets, with encrypted message bodies
- Toxicity filtering on messages via a Keras/TensorFlow model
- Language-partner matching and WebRTC video sessions
- Transactions with reviews and ratings
- Admin dashboard with role-based access control

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Redux Toolkit, SCSS, Tailwind |
| Backend | FastAPI, SQLAlchemy 2 (async), Alembic |
| Database | MySQL 8 |
| Storage | Local disk (default) or Amazon S3 behind CloudFront |
| Infra | Docker Compose; AWS (S3, CloudFront, IAM) |

## Quick Start

```bash
git clone https://github.com/<your-username>/Fulda-Bazaar.git
cd Fulda-Bazaar
cp .env.example .env      # then fill in the values, see below
docker compose up -d --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Adminer (DB UI) | http://localhost:8090 |

The backend entrypoint waits for MySQL, generates and applies an Alembic
migration, then seeds dummy data before starting uvicorn. The first boot takes a
few minutes to build the images.

## Configuration

Copy `.env.example` to `.env` and fill it in. Two values must be generated:

```bash
# SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# MESSAGE_CRYPT_KEY (Fernet)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`.env` is gitignored. Never commit it.

### Object storage

Uploads go through one seam, `backend/app/core/storage.py`, which has two
interchangeable backends selected by `STORAGE_BACKEND`:

- **`local`** (default) — writes to `MEDIA_ROOT` and serves the files from the app
  at `MEDIA_URL_PREFIX`. A fresh clone runs with no cloud account at all.
- **`s3`** — uploads to an S3 bucket, served through a CloudFront distribution.

Both return a public URL from `upload()` and accept it back in `key_from_url()`,
so callers never know which is active. To use S3:

```
STORAGE_BACKEND=s3
AWS_S3_BUCKET=your-uploads-bucket
AWS_REGION=eu-central-1
AWS_S3_PUBLIC_BASE_URL=https://your-distribution.cloudfront.net
```

The bucket keeps Block Public Access fully enabled. CloudFront reads it through
an Origin Access Control — a bucket policy granting `s3:GetObject` to the
CloudFront service principal, scoped by `SourceArn` to one distribution — so
objects load through the CDN and return 403 directly from S3. That is why
`AWS_S3_PUBLIC_BASE_URL` must be the CloudFront domain; pointing it at the bucket
URL makes every image 403.

Credentials use the standard boto3 chain. Running locally, supply keys for an IAM
user restricted to this one bucket (`infra/aws/app-s3-policy.json` grants
`PutObject`, `GetObject` and `DeleteObject` on its objects and nothing else). On
EC2, set no keys and attach an instance role instead — boto3 finds it by itself,
leaving no long-lived secret in the deployment.

## Local Development

**Backend** — needs a reachable MySQL and a `.env` in `backend/`:

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Python 3.11 is recommended. The optional toxicity filter pins
`tensorflow==2.15.0` in `requirements-ml.txt`, which has no wheels for 3.12+; the
base `requirements.txt` has no such constraint.

**Frontend:**

```bash
cd frontend
cp .env.example .env.local     # add your Google Maps key here
npm install --legacy-peer-deps
npm run dev                    # http://localhost:5173
```

The map view and address autocomplete need `VITE_GOOGLE_MAPS_API_KEY`. Any key
Vite injects is bundled into the JavaScript and is therefore visible to anyone
using the site, so restrict it by HTTP referrer in the Google Cloud console
rather than relying on it staying secret.

The dev server calls the backend directly, so the backend allows
`localhost:5173` via CORS. Override the allowed list with `CORS_ORIGINS`
(comma-separated) in production.

## Secrets

No credential belongs in this repository. Everything is read from the
environment; `.env` and `credentials/` are gitignored.

Two layers guard this:

- **Pre-commit hook** — blocks commits containing API keys, cloud access keys,
  tokens or private-key blocks. Enable it once per clone:

  ```bash
  git config core.hooksPath .githooks
  ```

- **CI** — `.github/workflows/secret-scan.yml` runs gitleaks over the full
  history on every push and pull request.

If a secret does get committed, rewriting history is *not* sufficient: force-pushing
leaves the old commits reachable by SHA on the remote. Revoke and reissue the
credential first, then clean up the history.

## Project Structure

```
backend/          FastAPI app
  app/api/        route handlers
  app/models/     SQLAlchemy models
  app/services/   toxicity model, encryption, 2FA, matcher
  app/ML/         Keras toxicity model + tokenizer
  alembic/        migrations
frontend/         React + TypeScript app
database/         MySQL init script
infra/aws/        IAM policy and budget script
infra/terraform_gcp/  legacy GCP Terraform, unused
```

## Known Limitations

- The `LanguageExchange` frontend components are empty placeholders; language
  exchange is reached through the language-partner flow instead.
- `entrypoint.sh` regenerates migrations from scratch on every boot, so
  `alembic/versions/` is gitignored. This is convenient for development but is
  not a real migration history.
- The seed script populates dummy users and listings; it is not idempotent.
- `entrypoint.sh` runs the seed as `run_seed || true`, so a seeding failure does
  not stop the container. The app then boots healthy against an unseeded
  database and fails later with a misleading error.
