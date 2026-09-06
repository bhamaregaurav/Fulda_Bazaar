"""Optional toxicity filter for chat messages.

TensorFlow adds roughly 2GB to the image and ~1.5GB of resident memory, so it
is opt-in: set ENABLE_TOXICITY=true and install requirements-ml.txt. When
disabled, is_toxic() always returns False and TensorFlow is never imported.

The model is loaded on first use rather than at import, so even with the filter
enabled the app starts immediately and pays the cost only once a message is
actually checked.
"""
import functools
import os
import pathlib
import pickle
import threading

MAX_LEN = 200
THRESH = 0.55
_BASE = pathlib.Path(__file__).parent.parent / "ML"

ENABLED = os.getenv("ENABLE_TOXICITY", "false").lower() in ("1", "true", "yes")

_lock = threading.Lock()
_model = None
_tokenizer = None
_pad_sequences = None


def _load():
    """Import TensorFlow and load the model. Called once, on first check."""
    global _model, _tokenizer, _pad_sequences
    if _model is not None:
        return
    with _lock:
        if _model is not None:
            return
        import tensorflow as tf
        from tensorflow.keras.preprocessing.sequence import pad_sequences

        _pad_sequences = pad_sequences
        _model = tf.keras.models.load_model(_BASE / "NoisyBazaarUP.h5", compile=False)
        with open(_BASE / "tokenizer.pkl", "rb") as fh:
            _tokenizer = pickle.load(fh)


@functools.lru_cache(maxsize=1024)
def _score_once(text: str) -> float:
    from app.services.text_clean import clean

    _load()
    seq = _tokenizer.texts_to_sequences([clean(text)])
    X = _pad_sequences(seq, maxlen=MAX_LEN, padding="post", truncating="post")
    return float(_model.predict(X, verbose=0)[0][0])


async def is_toxic(text: str) -> bool:
    if not ENABLED:
        return False
    try:
        return _score_once(text) >= THRESH
    except Exception as e:
        # A missing model or absent TensorFlow must not break messaging.
        print(f"WARNING: toxicity check unavailable ({e}); allowing message")
        return False
