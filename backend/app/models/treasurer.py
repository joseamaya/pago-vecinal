from beanie import Document
from typing import Optional

class Treasurer(Document):
    villa: str
    name: str
    signature: Optional[str] = None

    class Settings:
        name = "treasurers"
