import re, html, unicodedata

URL_RE    = re.compile(r"http\S+")
EMAIL_RE  = re.compile(r"\b\S+@\S+\.\S+\b")
NUM_RE    = re.compile(r"\d+")
PUNCT_RE  = re.compile(r"[^\w\s]", flags=re.UNICODE)

# wide-ranging emoji block (covers most symbols & pictographs)
EMOJI_RE  = re.compile(
    "["                     # start char-class
    "\U0001F300-\U0001F6FF" # transport & map, etc.
    "\U0001F700-\U0001F77F" # alchemical
    "\U0001F900-\U0001F9FF" # supplemental symbols
    "\U0001FA70-\U0001FAFF" # symbols & pictographs ext-B
    "\u2600-\u26FF"         # misc symbols
    "\u2700-\u27BF"         # dingbats
    "]+",
    flags=re.UNICODE,
)

def clean(text: str) -> str:
    text = html.unescape(text)
    text = URL_RE.sub("", text)
    text = EMAIL_RE.sub("", text)
    text = NUM_RE.sub(" ", text)         # drop numbers
    text = EMOJI_RE.sub(" ", text)       # drop emojis
    text = unicodedata.normalize("NFKC", text)
    text = PUNCT_RE.sub(" ", text)
    return " ".join(text.lower().split())
