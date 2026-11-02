import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ENVIRONMENT = os.getenv("PINGO_ENVIRONMENT", "development")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'pingo.db'}")
JWT_SECRET = os.getenv("JWT_SECRET", "development-only-change-this-secret-before-deploying")
if ENVIRONMENT == "production" and (
    "JWT_SECRET" not in os.environ
    or len(JWT_SECRET) < 32
    or JWT_SECRET == "development-only-change-this-secret-before-deploying"
):
    raise RuntimeError("Set a unique JWT_SECRET of at least 32 characters in production")
if ENVIRONMENT == "production" and not DATABASE_URL.startswith("postgresql+"):
    raise RuntimeError("DATABASE_URL must use PostgreSQL in production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
UPLOAD_ROOT = Path(os.getenv("PRIVATE_UPLOAD_ROOT", str(ROOT / "private_uploads"))).resolve()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
    if origin.strip()
]
