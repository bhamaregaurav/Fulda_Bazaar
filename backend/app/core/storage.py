"""Object storage with swappable backends.

STORAGE_BACKEND=local (default) writes to disk and serves the files from the
app itself, so the project runs with no cloud account at all. STORAGE_BACKEND=s3
writes to an S3 bucket.

Both backends return a public URL from upload() and accept that same URL back
in key_from_url(), so callers never care which one is active.
"""
import os
import pathlib
import shutil
from typing import BinaryIO, Optional
from urllib.parse import urlparse

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").lower()


class LocalStorage:
    """Stores files under MEDIA_ROOT, served by the app at MEDIA_URL_PREFIX."""

    def __init__(self) -> None:
        self.root = pathlib.Path(os.getenv("MEDIA_ROOT", "/app/media")).resolve()
        self.prefix = os.getenv("MEDIA_URL_PREFIX", "/media").rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> pathlib.Path:
        # Refuse keys that would escape the media root.
        target = (self.root / key).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError(f"refusing to write outside media root: {key!r}")
        return target

    def upload(self, key: str, fileobj: BinaryIO, content_type: Optional[str] = None) -> str:
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        fileobj.seek(0)
        with target.open("wb") as fh:
            shutil.copyfileobj(fileobj, fh)
        return f"{self.prefix}/{key}"

    def delete(self, key: str) -> None:
        try:
            self._path(key).unlink(missing_ok=True)
        except ValueError:
            pass

    def key_from_url(self, url: str) -> Optional[str]:
        path = urlparse(url).path
        if path.startswith(self.prefix + "/"):
            return path[len(self.prefix) + 1:]
        return None


class S3Storage:
    """Stores files in an S3 bucket.

    Credentials come from the standard boto3 chain, so on EC2 this is an
    instance role and no keys are needed anywhere.
    """

    def __init__(self) -> None:
        import boto3  # imported lazily so local runs need no AWS deps

        self.bucket = os.environ["AWS_S3_BUCKET"]
        self.region = os.getenv("AWS_REGION", "eu-central-1")
        # Set this to a CloudFront domain to serve uploads through the CDN.
        self.public_base = os.getenv(
            "AWS_S3_PUBLIC_BASE_URL",
            f"https://{self.bucket}.s3.{self.region}.amazonaws.com",
        ).rstrip("/")
        self._client = boto3.client("s3", region_name=self.region)

    def upload(self, key: str, fileobj: BinaryIO, content_type: Optional[str] = None) -> str:
        extra = {"ContentType": content_type} if content_type else {}
        fileobj.seek(0)
        self._client.upload_fileobj(fileobj, self.bucket, key, ExtraArgs=extra)
        return f"{self.public_base}/{key}"

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key)

    def key_from_url(self, url: str) -> Optional[str]:
        if url.startswith(self.public_base + "/"):
            return url[len(self.public_base) + 1:]
        # Also accept the raw bucket URL when public_base is a CDN domain.
        parsed = urlparse(url)
        if self.bucket in parsed.netloc:
            return parsed.path.lstrip("/")
        return None


def _build():
    if STORAGE_BACKEND == "s3":
        return S3Storage()
    if STORAGE_BACKEND != "local":
        raise ValueError(f"unknown STORAGE_BACKEND {STORAGE_BACKEND!r}; use 'local' or 's3'")
    return LocalStorage()


storage = _build()
