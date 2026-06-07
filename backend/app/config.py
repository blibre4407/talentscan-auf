import os
from typing import List


def _split_csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./data/talentscan.db")
        self.cv_storage_dir = os.getenv("CV_STORAGE_DIR", "./data/cv_storage")
        self.faiss_index_path = os.getenv("FAISS_INDEX_PATH", "./data/talentscan.index")
        self.cors_allowed_origins = _split_csv(
            os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        )


settings = Settings()
