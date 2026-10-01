"""Small per-user collections stored in one table, validated per kind.

    idea       the ideas backlog (from research runs, trend watch, week plans, or typed in)
    series     recurring formats such as "Tip Tuesday"
    brand_kit  extra brand kits beyond the primary one on the profile
    preset     saved design settings ("my templates")
    font       uploaded font files
    metric     performance numbers for published posts (feeds the AI's previous_content)
"""

import re
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, StringConstraints, ValidationError
from starlette.concurrency import run_in_threadpool

from api.auth import current_user
from api.profile import Brand
from db import connection

router = APIRouter(prefix="/api/items", tags=["items"])

ID_PATTERN = r"^[A-Za-z0-9-]{6,64}$"
ItemId = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
Short = Annotated[str, StringConstraints(max_length=120)]
Text = Annotated[str, StringConstraints(max_length=600)]
DateStr = Annotated[str, StringConstraints(pattern=r"^(\d{4}-\d{2}-\d{2}.*)?$", max_length=40)]
Kind = Literal["carousel", "poster", "image", "thumbnail", "text", ""]


class Idea(BaseModel):
    title: Short
    angle: Text = ""
    reason: Text = ""
    topic: Text = ""
    source: Literal["research", "trend", "plan", "manual", "series"] = "manual"
    status: Literal["new", "used", "archived"] = "new"
    planned_for: DateStr = ""
    kind: Kind = ""
    series_id: Short = ""


class Series(BaseModel):
    name: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    weekday: int = Field(ge=0, le=6)  # 0 = Monday
    kind: Kind = "carousel"
    prompt: Text = ""
    template: Short = "auto"
    slide_count: int = Field(default=6, ge=3, le=10)
    active: bool = True


class BrandKit(Brand):
    kit_name: Annotated[str, StringConstraints(min_length=1, max_length=60)]


class Preset(BaseModel):
    name: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    design: dict[str, Any]


class Font(BaseModel):
    family: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9 _-]{1,40}$")]
    data: Annotated[
        str,
        StringConstraints(
            max_length=3_000_000,
            pattern=r"^data:(font/(woff2|woff|ttf|otf)|application/(font-woff|x-font-ttf|x-font-otf|octet-stream|vnd\.ms-opentype));base64,[A-Za-z0-9+/=]+$",
        ),
    ]


class Metric(BaseModel):
    platform: Short = ""
    posted_at: DateStr = ""
    title: Annotated[str, StringConstraints(max_length=300)] = ""
    url: Annotated[str, StringConstraints(max_length=500)] = ""
    project_id: Short = ""
    impressions: int = Field(default=0, ge=0)
    likes: int = Field(default=0, ge=0)
    comments: int = Field(default=0, ge=0)
    shares: int = Field(default=0, ge=0)
    saves: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)


# kind -> (model, max items, max bytes per item)
KINDS: dict[str, tuple[type[BaseModel], int, int]] = {
    "idea": (Idea, 1000, 10_000),
    "series": (Series, 30, 10_000),
    "brand_kit": (BrandKit, 20, 1_600_000),
    "preset": (Preset, 100, 50_000),
    "font": (Font, 12, 3_100_000),
    "metric": (Metric, 5000, 5_000),
}


def _spec(kind: str):
    if kind not in KINDS:
        raise HTTPException(404, "Unknown collection.")
    return KINDS[kind]


def _validate(kind: str, raw: dict) -> dict:
    model, _, _ = _spec(kind)
    try:
        return model.model_validate(raw).model_dump()
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_url=False, include_context=False, include_input=False)) from None


def _to_json(row: dict) -> dict:
    return {**row["data"], "id": row["id"], "createdAt": row["created_at"].isoformat(), "updatedAt": row["updated_at"].isoformat()}


def _upsert_many(user_id, kind: str, items: list[tuple[str, dict]]) -> list[dict]:
    _, limit, _ = _spec(kind)
    ids = [item_id for item_id, _ in items]
    with connection() as conn:
        count = conn.execute("SELECT count(*) AS n FROM user_items WHERE user_id = %s AND kind = %s", (user_id, kind)).fetchone()["n"]
        existing = conn.execute(
            "SELECT count(*) AS n FROM user_items WHERE user_id = %s AND kind = %s AND id = ANY(%s)", (user_id, kind, ids)
        ).fetchone()["n"]
        if count + len(set(ids)) - existing > limit:
            raise HTTPException(409, f"You can keep up to {limit} of these. Delete some first.")
        rows = []
        for item_id, data in items:
            rows.append(
                conn.execute(
                    """
                    INSERT INTO user_items (user_id, kind, id, data) VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id, kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                    RETURNING id, data, created_at, updated_at
                    """,
                    (user_id, kind, item_id, Jsonb(data)),
                ).fetchone()
            )
    return [_to_json(r) for r in rows]


@router.get("/{kind}")
def list_items(kind: str, user: dict = Depends(current_user)):
    _spec(kind)
    with connection() as conn:
        rows = conn.execute(
            "SELECT id, data, created_at, updated_at FROM user_items WHERE user_id = %s AND kind = %s ORDER BY updated_at DESC",
            (user["id"], kind),
        ).fetchall()
    return [_to_json(r) for r in rows]


@router.put("/{kind}/{item_id}")
async def save_item(kind: str, item_id: ItemId, request: Request, user: dict = Depends(current_user)):
    _, _, max_bytes = _spec(kind)
    raw = await request.body()
    if len(raw) > max_bytes:
        raise HTTPException(413, "This item is too large.")
    data = _validate(kind, await request.json())
    rows = await run_in_threadpool(_upsert_many, user["id"], kind, [(item_id, data)])
    return rows[0]


class Bulk(BaseModel):
    items: list[dict[str, Any]] = Field(max_length=500)


@router.post("/{kind}/bulk")
def save_items(kind: str, body: Bulk, user: dict = Depends(current_user)):
    """Create or update many items at once (metric imports, week plans, saved research ideas)."""
    pairs = []
    for raw in body.items:
        item_id = str(raw.get("id", ""))
        if not re.fullmatch(ID_PATTERN, item_id):
            raise HTTPException(422, "Every item needs a valid id.")
        pairs.append((item_id, _validate(kind, raw)))  # unknown keys (id, timestamps) are ignored
    return _upsert_many(user["id"], kind, pairs)


@router.delete("/{kind}/{item_id}")
def delete_item(kind: str, item_id: ItemId, user: dict = Depends(current_user)):
    _spec(kind)
    with connection() as conn:
        conn.execute("DELETE FROM user_items WHERE user_id = %s AND kind = %s AND id = %s", (user["id"], kind, item_id))
    return {"ok": True}
