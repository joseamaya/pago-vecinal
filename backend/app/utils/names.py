import re
import unicodedata

CONNECTORS = {
    "de",
    "del",
    "la",
    "las",
    "los",
    "y",
    "e",
    "da",
    "das",
    "do",
    "dos",
    "van",
    "von",
    "der",
    "den",
    "bin",
    "al",
}

WORD_PATTERN = re.compile(r"[^\W\d_]+", re.UNICODE)


def _capitalize_word(word: str) -> str:
    return WORD_PATTERN.sub(
        lambda match: match.group(0)[:1].upper() + match.group(0)[1:].lower(),
        word,
    )


def normalize_person_name(value: str) -> str:
    if value is None:
        return value

    cleaned = " ".join(str(value).split())
    if not cleaned:
        return cleaned

    tokens = cleaned.split(" ")
    normalized = []
    for index, token in enumerate(tokens):
        if index > 0 and token.lower() in CONNECTORS:
            normalized.append(token.lower())
        else:
            normalized.append(_capitalize_word(token))

    return " ".join(normalized)


def person_name_key(value: str) -> str:
    if value is None:
        return ""

    normalized = normalize_person_name(value)
    decomposed = unicodedata.normalize("NFKD", normalized)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return " ".join(without_accents.casefold().split())
