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
| Storage | Google Cloud Storage (optional) |
| Infra | Docker Compose, Terraform, GCP |

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
few minutes because the image installs TensorFlow.

## Configuration

Copy `.env.example` to `.env` and fill it in. Two values must be generated:

```bash
# SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# MESSAGE_CRYPT_KEY (Fernet)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`.env` is gitignored. Never commit it.

### Google Cloud Storage (optional)

Image upload writes to a GCS bucket. Without a service-account key the app still
starts — it logs a warning and only the upload endpoints fail. To enable it, put
your key at `backend/gcp_service_account.json` (gitignored) and set
`GCP_PROJECT_ID` / `GCP_BUCKET_NAME` in `.env`.

## Local Development

**Backend** — needs a reachable MySQL and a `.env` in `backend/`:

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Python 3.11 is required: `requirements.txt` pins `tensorflow==2.15.0`, which has
no wheels for 3.12+.

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
infra/            Terraform / GCP config
```

## Known Limitations

- The `LanguageExchange` frontend components are empty placeholders; language
  exchange is reached through the language-partner flow instead.
- `entrypoint.sh` regenerates migrations from scratch on every boot, so
  `alembic/versions/` is gitignored. This is convenient for development but is
  not a real migration history.
- The seed script populates dummy users and listings; it is not idempotent.
