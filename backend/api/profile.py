"""The signed-in user's brand kit and onboarding questionnaire answers."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, StringConstraints

from api.auth import current_user
from db import connection

router = APIRouter(prefix="/api/profile", tags=["profile"])

Hex = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Short = Annotated[str, StringConstraints(max_length=60)]
# Logos and photos are resized in the browser and stored inline as data URLs,
# so slides can embed them and exports never hit cross-origin image rules.
ImageData = Annotated[str, StringConstraints(max_length=700_000, pattern=r"^(data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$")]


class Brand(BaseModel):
    name: Short = ""
    handle: Annotated[str, StringConstraints(max_length=40)] = ""
    accent: Hex = "#ff5a3c"
    secondary: Hex | Literal[""] = ""
    palette: list[Hex] = Field(default_factory=list, max_length=8)
    mark: Literal["logo", "avatar", "initials"] = "initials"
    logo: ImageData = ""
    avatar: ImageData = ""
    template: Short = "auto"
    font: Short = "auto"
    hashtags: list[Annotated[str, StringConstraints(max_length=40)]] = Field(default_factory=list, max_length=15)


class Social(BaseModel):
    role: Short = ""
    platforms: list[Short] = Field(default_factory=list, max_length=12)
    primary_platform: Short = ""
    profile_url: Annotated[str, StringConstraints(max_length=300)] = ""
    audience: Annotated[str, StringConstraints(max_length=300)] = ""
    frequency: Short = ""
    content_types: list[Short] = Field(default_factory=list, max_length=12)
    formats: list[Short] = Field(default_factory=list, max_length=8)
    tone: Short = ""
    goals: list[Short] = Field(default_factory=list, max_length=8)
    niche: Annotated[str, StringConstraints(max_length=120)] = ""
    avoid_words: list[Short] = Field(default_factory=list, max_length=30)
    example_posts: list[Annotated[str, StringConstraints(max_length=2000)]] = Field(default_factory=list, max_length=3)


class ProfileUpdate(BaseModel):
    brand: Brand | None = None
    social: Social | None = None
    onboarded: bool | None = None


@router.put("")
def update_profile(body: ProfileUpdate, user: dict = Depends(current_user)):
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO profiles (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING
            """,
            (user["id"],),
        )
        conn.execute(
            """
            UPDATE profiles SET
                brand = COALESCE(%(brand)s::jsonb, brand),
                social = COALESCE(%(social)s::jsonb, social),
                onboarded_at = CASE
                    WHEN %(onboarded)s::boolean IS TRUE THEN COALESCE(onboarded_at, now())
                    WHEN %(onboarded)s::boolean IS FALSE THEN NULL
                    ELSE onboarded_at END,
                updated_at = now()
            WHERE user_id = %(user_id)s
            """,
            {
                "brand": Jsonb(body.brand.model_dump()) if body.brand else None,
                "social": Jsonb(body.social.model_dump()) if body.social else None,
                "onboarded": body.onboarded,
                "user_id": user["id"],
            },
        )
    return {"ok": True}


def _engagement(m: dict) -> float:
    interactions = m.get("likes", 0) + 2 * m.get("comments", 0) + 3 * m.get("shares", 0) + 2 * m.get("saves", 0)
    return interactions / max(m.get("impressions", 0), 1)


def brand_profile_for(user_id) -> dict | None:
    """Everything the agents should know about this creator: voice, audience, niche,
    words to avoid, example posts, and the imported posts that performed best."""
    with connection() as conn:
        row = conn.execute("SELECT brand, social FROM profiles WHERE user_id = %s", (user_id,)).fetchone()
        metrics = conn.execute(
            "SELECT data FROM user_items WHERE user_id = %s AND kind = 'metric' ORDER BY updated_at DESC LIMIT 500",
            (user_id,),
        ).fetchall()
    if not row or not row["social"]:
        return None
    social, brand = row["social"], row["brand"]

    top = sorted((m["data"] for m in metrics if m["data"].get("impressions")), key=_engagement, reverse=True)[:5]
    return {
        "voice": {
            "brand_name": brand.get("name", ""),
            "role": social.get("role", ""),
            "niche": social.get("niche", ""),
            "tone": social.get("tone", ""),
            "audience": social.get("audience", ""),
            "goals": ", ".join(social.get("goals", [])),
            "content_they_post": ", ".join(social.get("content_types", [])),
            "platforms": ", ".join(social.get("platforms", [])),
        },
        "words_to_avoid": ["em dashes", "emojis", *social.get("avoid_words", [])],
        "example_posts": social.get("example_posts", []),
        "previous_content": [
            {
                "title": m.get("title", ""),
                "platform": m.get("platform", ""),
                "engagement_rate": f"{_engagement(m) * 100:.1f}%",
            }
            for m in top
        ],
    }
