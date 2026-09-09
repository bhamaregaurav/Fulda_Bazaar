"""Registers every model with SQLAlchemy's declarative registry.

Relationships are declared by class *name* (e.g. relationship("Permission")),
and SQLAlchemy can only resolve those names for classes that have actually
been imported. Importing any submodule runs this file first, so a consumer
that only needs User still gets the whole registry and string lookups resolve.

Without this, each caller had to import every model by hand, and forgetting
one failed far away with "expression '<Name>' failed to locate a name".
"""

from . import permission_model
from . import user_models
from . import listing_model
from . import watchlist_model
from . import chat_models
from . import review_model
from . import transaction_model
from . import language_partner_model

__all__ = [
    "permission_model",
    "user_models",
    "listing_model",
    "watchlist_model",
    "chat_models",
    "review_model",
    "transaction_model",
    "language_partner_model",
]
