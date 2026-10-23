from typing import Any, Optional


def link_ref_id(value: Any) -> Optional[Any]:
    """Return the referenced ObjectId for a Beanie Link or document."""
    if value is None:
        return None
    ref = getattr(value, "ref", None)
    if ref is not None:
        return ref.id
    return getattr(value, "id", None)


def link_id(value: Any) -> Optional[str]:
    """Return the referenced id as a string for a Beanie Link or document."""
    ref_id = link_ref_id(value)
    return str(ref_id) if ref_id is not None else None
