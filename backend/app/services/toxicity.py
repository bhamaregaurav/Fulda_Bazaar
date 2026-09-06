import pathlib, pickle, functools, numpy as np, tensorflow as tf
from tensorflow.keras.preprocessing.sequence import pad_sequences
from app.services.text_clean import clean

MAX_LEN = 200
THRESH  = 0.55
_BASE   = pathlib.Path(__file__).parent.parent / "ML"

# ⬇ choose ONE line that matches what you exported
_MODEL = tf.keras.models.load_model(_BASE / "NoisyBazaarUP.h5", compile=False)
# _MODEL = tf.keras.models.load_model(_BASE / "NoisyBazaar_savedmodel", compile=False)

with open(_BASE / "tokenizer.pkl", "rb") as fh:
    _TOKENIZER = pickle.load(fh)

@functools.lru_cache(maxsize=1024)
def _score_once(text: str) -> float:
    seq = _TOKENIZER.texts_to_sequences([clean(text)])
    X   = pad_sequences(seq, maxlen=MAX_LEN, padding="post", truncating="post")
    return float(_MODEL.predict(X, verbose=0)[0][0])

async def is_toxic(text: str) -> bool:
    return _score_once(text) >= THRESH
