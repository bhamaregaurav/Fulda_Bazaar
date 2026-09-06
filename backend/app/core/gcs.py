import os

from google.cloud import storage
from google.oauth2 import service_account

GCP_CRED_FILE = os.getenv("GCP_CRED_FILE", "gcp_service_account.json")
GCP_PROJECT   = os.getenv("GCP_PROJECT_ID", "gdsd-465815")
GCP_BUCKET    = os.getenv("GCP_BUCKET_NAME", "fulda-bazaar-content")


def _make_bucket():
    """Return the GCS bucket, or None when no service-account key is present.

    The key is not committed, so the app has to come up without it. Image
    uploads then fail per-request instead of taking the whole server down
    at import time.
    """
    if not os.path.exists(GCP_CRED_FILE):
        print(f"WARNING: {GCP_CRED_FILE} not found - image upload is disabled")
        return None

    credentials = service_account.Credentials.from_service_account_file(GCP_CRED_FILE)
    client = storage.Client(credentials=credentials, project=GCP_PROJECT)
    return client.bucket(GCP_BUCKET)


bucket = _make_bucket()
