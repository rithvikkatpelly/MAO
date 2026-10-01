"""Runtime configuration, read from the environment (and backend/.env in development).

See backend/.env.example and docs/setup.md for every setting.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def _flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


# postgresql://user:password@host:port/dbname  (Neon, Supabase, local, or Cloud SQL)
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# OAuth 2.0 Web client ID from Google Cloud Console > Google Auth Platform > Clients
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()
]

SESSION_COOKIE = "aurea_session"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
# Production (HTTPS): COOKIE_SECURE=true. If the app and API live on different sites,
# also COOKIE_SAMESITE=none (serving both from one domain is preferred).
COOKIE_SECURE = _flag("COOKIE_SECURE")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()

# Local development only: adds a "Continue as local developer" sign-in that skips Google.
# Refused for any request that does not come from this machine.
DEV_LOGIN = _flag("DEV_LOGIN")
