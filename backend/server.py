"""GymBuddy backend API — FastAPI + MongoDB (motor)."""
from __future__ import annotations

import os
import re
import time
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import bcrypt
import jwt
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from exercise_data import (
    EXERCISES, MUSCLES, EQUIPMENT, DIFFICULTY, CATEGORY, TYPE, PATTERN, LANGS,
)
from templates_data import TEMPLATES, GOALS, EXPERIENCE
from exercise_media import EXERCISE_MEDIA

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production-gymbuddy")
JWT_ALGO = "HS256"
ACCESS_DAYS = 30
ROOT_ADMIN_EMAIL = os.environ.get("ROOT_ADMIN_EMAIL", "admin@gymbuddy.app").lower()
ROOT_ADMIN_PASSWORD = os.environ.get("ROOT_ADMIN_PASSWORD", "AdminGym2026!")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="GymBuddy API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("gymbuddy")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt(rounds=12)).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except (ValueError, TypeError):
        return False


def make_token(uid: str) -> str:
    now = now_utc()
    return jwt.encode(
        {"sub": uid, "iat": now, "exp": now + timedelta(days=ACCESS_DAYS)},
        JWT_SECRET, algorithm=JWT_ALGO,
    )


def public_user(u: dict) -> dict:
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u


_hits: Dict[str, List[float]] = {}


def rate_limit(key: str, limit: int = 10, window: int = 60):
    now = time.time()
    arr = [t for t in _hits.get(key, []) if now - t < window]
    if len(arr) >= limit:
        raise HTTPException(429, "Too many attempts, please wait a moment.")
    arr.append(now)
    _hits[key] = arr


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    err = HTTPException(401, "Invalid or missing credentials")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise err
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise err
    user = await db.users.find_one({"id": claims.get("sub")})
    if not user or user.get("deleted_at"):
        raise err
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


EQUIP_SET = set(EQUIPMENT.keys())
EX_BY_ID = {e["id"]: e for e in EXERCISES}


def exercise_available(ex: dict, owned: set) -> bool:
    req = set(ex.get("required_equipment", []))
    if not req or req == {"bodyweight"}:
        return True
    return req.issubset(owned | {"bodyweight"})


def localize_exercise(ex: dict, lang: str) -> dict:
    lang = lang if lang in LANGS else "en"
    loc = ex.get("localized", {}).get(lang, {})
    media = EXERCISE_MEDIA.get(ex["id"])
    return {
        "id": ex["id"],
        "name": ex["localized_names"].get(lang, ex["name"]),
        "name_en": ex["name"],
        "category": ex["category"],
        "category_label": CATEGORY.get(ex["category"], {}).get(lang, ex["category"]),
        "primary_muscle": ex["primary_muscle"],
        "primary_muscle_label": MUSCLES.get(ex["primary_muscle"], {}).get(lang, ex["primary_muscle"]),
        "secondary_muscles": ex["secondary_muscles"],
        "secondary_muscle_labels": [MUSCLES.get(m, {}).get(lang, m) for m in ex["secondary_muscles"]],
        "required_equipment": ex["required_equipment"],
        "required_equipment_labels": [EQUIPMENT.get(e, {}).get(lang, e) for e in ex["required_equipment"]],
        "optional_equipment": ex.get("optional_equipment", []),
        "difficulty": ex["difficulty"],
        "difficulty_label": DIFFICULTY.get(ex["difficulty"], {}).get(lang, ex["difficulty"]),
        "exercise_type": ex["exercise_type"],
        "exercise_type_label": TYPE.get(ex["exercise_type"], {}).get(lang, ex["exercise_type"]),
        "movement_pattern": ex["movement_pattern"],
        "movement_pattern_label": PATTERN.get(ex["movement_pattern"], {}).get(lang, ex["movement_pattern"]),
        "instructions": loc.get("instructions", ""),
        "starting_position": loc.get("starting_position", ""),
        "execution": loc.get("execution", ""),
        "breathing": loc.get("breathing", ""),
        "safety": loc.get("safety", ""),
        "common_mistakes": loc.get("common_mistakes", []),
        "has_image": ex.get("has_image", True),
        "has_animation": ex.get("has_animation", False),
        "photos": media["images"] if media else [],
        "photo_match": media.get("match", "") if media else "",
        "photo_attribution": "Free Exercise DB (public domain)" if media else "",
        "media_attribution": ex.get("media_attribution", ""),
        "alternatives": ex.get("alternatives", []),
        "easier_variation": ex.get("easier_variation"),
        "harder_variation": ex.get("harder_variation"),
    }


# --------------------------------------------------------------------------- #
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    goal: Optional[str] = None
    experience: Optional[str] = None
    training_days: Optional[List[str]] = None
    workout_duration_min: Optional[int] = None
    equipment: Optional[List[str]] = None
    units: Optional[str] = None
    language: Optional[str] = None
    avatar: Optional[str] = None
    notifications: Optional[Dict[str, Any]] = None
    privacy: Optional[Dict[str, Any]] = None
    leaderboard_optin: Optional[bool] = None


class MeasurementIn(BaseModel):
    weight_kg: Optional[float] = None
    body_fat: Optional[float] = None
    chest: Optional[float] = None
    waist: Optional[float] = None
    hips: Optional[float] = None
    arm: Optional[float] = None
    thigh: Optional[float] = None
    calf: Optional[float] = None
    photo: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None


class PlanIn(BaseModel):
    name: str
    description: Optional[str] = ""
    days: List[Dict[str, Any]] = []
    source_template: Optional[str] = None
    tags: List[str] = []


class GenerateIn(BaseModel):
    goal: str
    experience: str
    days_per_week: int
    workout_duration_min: int = 60


class SessionStart(BaseModel):
    plan_id: Optional[str] = None
    day_index: Optional[int] = None
    name: Optional[str] = None
    exercises: Optional[List[Dict[str, Any]]] = None


class CustomFoodIn(BaseModel):
    name: str
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    serving: str = "100g"


class FoodEntryIn(BaseModel):
    name: str
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    meal: str = "breakfast"
    quantity: float = 1
    date: Optional[str] = None
    barcode: Optional[str] = None


DEFAULT_NOTIFS = {"workouts": True, "weight": True, "measurements": True, "rest_days": False, "streak": True}
DEFAULT_PRIVACY = {"profile_public": False, "share_workouts": False}


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
@api.post("/auth/register")
async def register(body: RegisterIn):
    rate_limit("reg:" + body.email.lower(), limit=6, window=60)
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "This email is already registered.")
    uid = str(uuid.uuid4())
    is_root = email == ROOT_ADMIN_EMAIL
    user = {
        "id": uid, "name": body.name.strip(), "email": email,
        "password_hash": hash_pw(body.password),
        "role": "admin" if is_root else "user", "root_admin": is_root,
        "onboarded": False, "date_of_birth": None, "gender": None,
        "height_cm": None, "weight_kg": None, "target_weight_kg": None,
        "goal": None, "experience": None, "training_days": [],
        "workout_duration_min": 60, "equipment": ["bodyweight"],
        "units": "metric", "language": "en", "avatar": None,
        "notifications": DEFAULT_NOTIFS, "privacy": DEFAULT_PRIVACY,
        "leaderboard_optin": False, "subscription": "free",
        "xp": 0, "level": 1, "streak": 0, "best_streak": 0,
        "achievements": [], "last_workout_date": None,
        "created_at": iso(now_utc()), "deleted_at": None,
    }
    await db.users.insert_one(dict(user))
    return {"token": make_token(uid), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    rate_limit("login:" + body.email.lower(), limit=10, window=60)
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or user.get("deleted_at") or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Incorrect email or password.")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# --------------------------------------------------------------------------- #
# Profile / users
# --------------------------------------------------------------------------- #
def _clean_equipment(eq: List[str]) -> List[str]:
    out = [e for e in eq if e in EQUIP_SET] or ["bodyweight"]
    if "bodyweight" not in out:
        out.append("bodyweight")
    return out


@api.put("/users/me")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "equipment" in updates:
        updates["equipment"] = _clean_equipment(updates["equipment"])
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user(fresh)


@api.post("/users/me/onboarding")
async def complete_onboarding(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "equipment" in updates:
        updates["equipment"] = _clean_equipment(updates["equipment"])
    updates["onboarded"] = True
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    if updates.get("weight_kg"):
        await db.measurements.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"],
            "weight_kg": updates["weight_kg"], "date": iso(now_utc()),
            "created_at": iso(now_utc()),
        })
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user(fresh)


@api.delete("/users/me")
async def delete_account(user: dict = Depends(get_current_user)):
    if user.get("root_admin"):
        raise HTTPException(403, "The root admin account cannot be deleted.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"deleted_at": iso(now_utc())}})
    return {"ok": True}


@api.get("/users/me/export")
async def export_data(user: dict = Depends(get_current_user)):
    sessions = await db.sessions.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    plans = await db.plans.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).to_list(500)
    measurements = await db.measurements.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    food = await db.food_entries.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)
    return {"profile": public_user(user), "sessions": sessions, "plans": plans,
            "measurements": measurements, "food_entries": food, "exported_at": iso(now_utc())}


# --------------------------------------------------------------------------- #
# Exercises
# --------------------------------------------------------------------------- #
@api.get("/exercises/meta")
async def exercises_meta(lang: str = "en"):
    lang = lang if lang in LANGS else "en"
    return {
        "muscles": [{"slug": k, "label": v.get(lang, k)} for k, v in MUSCLES.items()],
        "equipment": [{"slug": k, "label": v.get(lang, k)} for k, v in EQUIPMENT.items()],
        "categories": [{"slug": k, "label": v.get(lang, k)} for k, v in CATEGORY.items()],
        "difficulties": [{"slug": k, "label": v.get(lang, k)} for k, v in DIFFICULTY.items()],
        "types": [{"slug": k, "label": v.get(lang, k)} for k, v in TYPE.items()],
        "goals": [{"slug": k, "label": v.get(lang, k)} for k, v in GOALS.items()],
        "experience": [{"slug": k, "label": v.get(lang, k)} for k, v in EXPERIENCE.items()],
        "total_exercises": len(EXERCISES),
    }


@api.get("/exercises")
async def list_exercises(
    search: str = "", muscle: str = "", equipment: str = "", difficulty: str = "",
    type: str = "", category: str = "", available_only: bool = False,
    lang: str = "en", limit: int = 40, offset: int = 0,
    user: dict = Depends(get_current_user),
):
    owned = set(user.get("equipment", ["bodyweight"]))
    s = search.strip().lower()
    results = []
    for ex in EXERCISES:
        if not ex.get("is_active", True):
            continue
        if muscle and ex["primary_muscle"] != muscle and muscle not in ex["secondary_muscles"]:
            continue
        if equipment and equipment not in ex["required_equipment"]:
            continue
        if difficulty and ex["difficulty"] != difficulty:
            continue
        if type and ex["exercise_type"] != type:
            continue
        if category and ex["category"] != category:
            continue
        if available_only and not exercise_available(ex, owned):
            continue
        if s:
            hay = " ".join(ex["localized_names"].values()).lower()
            if s not in hay:
                continue
        results.append(ex)
    total = len(results)
    page = results[offset:offset + limit]
    return {"total": total, "items": [
        {**localize_exercise(ex, lang), "available": exercise_available(ex, owned)} for ex in page]}


@api.get("/exercises/{ex_id}")
async def get_exercise(ex_id: str, lang: str = "en", user: dict = Depends(get_current_user)):
    ex = EX_BY_ID.get(ex_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    owned = set(user.get("equipment", ["bodyweight"]))
    data = localize_exercise(ex, lang)
    data["available"] = exercise_available(ex, owned)
    data["alternatives_detail"] = [
        localize_exercise(EX_BY_ID[a], lang) for a in ex.get("alternatives", []) if a in EX_BY_ID][:6]
    sessions = await db.sessions.find(
        {"user_id": user["id"], "status": "completed", "exercises.exercise_id": ex_id},
        {"_id": 0}).sort("finished_at", -1).to_list(50)
    history = []
    best = 0.0
    for sess in sessions:
        for se in sess.get("exercises", []):
            if se.get("exercise_id") != ex_id:
                continue
            top = 0.0
            vol = 0.0
            for st in se.get("sets", []):
                if st.get("done"):
                    w = st.get("weight") or 0
                    r = st.get("reps") or 0
                    top = max(top, w)
                    vol += w * r
            history.append({"date": sess.get("finished_at"), "top_weight": top, "volume": vol})
            best = max(best, top)
    data["history"] = history[:20]
    data["personal_best"] = best
    return data


# --------------------------------------------------------------------------- #
# Plan generation & templates
# --------------------------------------------------------------------------- #
def pick_exercises_for_slot(sl: dict, owned: set, experience: str, used: set) -> List[dict]:
    diff_rank = {"beginner": 0, "intermediate": 1, "advanced": 2}
    max_diff = diff_rank.get(experience, 1)
    candidates = []
    for ex in EXERCISES:
        if ex["id"] in used:
            continue
        if not exercise_available(ex, owned):
            continue
        if sl["type"] != "any" and ex["exercise_type"] != sl["type"]:
            continue
        if ex["primary_muscle"] not in sl["muscles"]:
            continue
        if diff_rank.get(ex["difficulty"], 1) > max_diff + 1:
            continue
        candidates.append(ex)
    candidates.sort(key=lambda e: (abs(diff_rank.get(e["difficulty"], 1) - max_diff), not e.get("has_animation", False)))
    return candidates[: sl.get("count", 1)]


def default_scheme(ex: dict, goal: str) -> dict:
    t = ex["exercise_type"]
    if t == "cardio":
        return {"sets": 1, "reps": 0, "rest": 60, "duration_min": 15}
    if goal == "gain_strength":
        return {"sets": 5, "reps": 5, "rest": 180}
    if goal == "lose_weight":
        return {"sets": 3, "reps": 15, "rest": 45}
    if t == "isolation":
        return {"sets": 3, "reps": 12, "rest": 60}
    return {"sets": 4, "reps": 8, "rest": 90}


def build_plan_from_template(tpl: dict, user: dict, lang: str) -> dict:
    owned = set(user.get("equipment", ["bodyweight"]))
    goal = user.get("goal") or "build_muscle"
    experience = user.get("experience") or "beginner"
    days = []
    for d in tpl["days"]:
        used: set = set()
        exercises = []
        for sl in d["slots"]:
            for ex in pick_exercises_for_slot(sl, owned, experience, used):
                used.add(ex["id"])
                scheme = default_scheme(ex, goal)
                exercises.append({
                    "exercise_id": ex["id"], "name": ex["localized_names"].get(lang, ex["name"]),
                    "primary_muscle": ex["primary_muscle"], **scheme,
                    "weight": 0, "rpe": None, "notes": "",
                    "superset": None, "warmup": False, "dropset": False})
        days.append({"name": d["name"].get(lang, d["name"]["en"]), "exercises": exercises})
    return {"name": tpl["name"].get(lang, tpl["name"]["en"]),
            "description": tpl["description"].get(lang, tpl["description"]["en"]),
            "days": days, "source_template": tpl["id"], "tags": tpl.get("tags", [])}


@api.get("/plans/templates")
async def list_templates(lang: str = "en", user: dict = Depends(get_current_user)):
    lang = lang if lang in LANGS else "en"
    return {"items": [{
        "id": tpl["id"], "name": tpl["name"].get(lang, tpl["name"]["en"]),
        "description": tpl["description"].get(lang, tpl["description"]["en"]),
        "days_per_week": tpl["days_per_week"], "goal": tpl["goal"],
        "experience": tpl["experience"], "tags": tpl.get("tags", []),
        "day_count": len(tpl["days"])} for tpl in TEMPLATES]}


@api.post("/plans/from-template/{template_id}")
async def create_from_template(template_id: str, lang: str = "en", user: dict = Depends(get_current_user)):
    tpl = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not tpl:
        raise HTTPException(404, "Template not found")
    built = build_plan_from_template(tpl, user, lang if lang in LANGS else "en")
    plan = {"id": str(uuid.uuid4()), "user_id": user["id"], **built,
            "created_at": iso(now_utc()), "deleted_at": None}
    await db.plans.insert_one(dict(plan))
    plan.pop("_id", None)
    return plan


@api.post("/plans/generate")
async def generate_plan(body: GenerateIn, lang: str = "en", user: dict = Depends(get_current_user)):
    def score(tpl):
        s = 0
        if body.goal in tpl["goal"]:
            s += 3
        if body.experience in tpl["experience"]:
            s += 2
        s -= abs(tpl["days_per_week"] - body.days_per_week)
        return s
    best = max(TEMPLATES, key=score)
    tmp_user = {**user, "goal": body.goal, "experience": body.experience}
    built = build_plan_from_template(best, tmp_user, lang if lang in LANGS else "en")
    built["name"] = built["name"] + " ⚡"
    plan = {"id": str(uuid.uuid4()), "user_id": user["id"], **built,
            "created_at": iso(now_utc()), "deleted_at": None, "generated": True}
    await db.plans.insert_one(dict(plan))
    plan.pop("_id", None)
    return plan


@api.get("/plans")
async def list_plans(user: dict = Depends(get_current_user)):
    plans = await db.plans.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": plans}


@api.post("/plans")
async def create_plan(body: PlanIn, user: dict = Depends(get_current_user)):
    plan = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
            "created_at": iso(now_utc()), "deleted_at": None}
    await db.plans.insert_one(dict(plan))
    plan.pop("_id", None)
    return plan


@api.get("/plans/{plan_id}")
async def get_plan(plan_id: str, user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"id": plan_id, "user_id": user["id"], "deleted_at": None}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan not found")
    return plan


@api.put("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanIn, user: dict = Depends(get_current_user)):
    res = await db.plans.update_one(
        {"id": plan_id, "user_id": user["id"], "deleted_at": None}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Plan not found")
    return await db.plans.find_one({"id": plan_id}, {"_id": 0})


@api.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(get_current_user)):
    await db.plans.update_one({"id": plan_id, "user_id": user["id"]}, {"$set": {"deleted_at": iso(now_utc())}})
    return {"ok": True}


@api.post("/plans/{plan_id}/duplicate")
async def duplicate_plan(plan_id: str, user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"id": plan_id, "user_id": user["id"], "deleted_at": None}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan not found")
    dup = dict(plan)
    dup["id"] = str(uuid.uuid4())
    dup["name"] = plan["name"] + " (copy)"
    dup["created_at"] = iso(now_utc())
    await db.plans.insert_one(dict(dup))
    dup.pop("_id", None)
    return dup


# --------------------------------------------------------------------------- #
# Sessions (active workout)
# --------------------------------------------------------------------------- #
ACHIEVEMENTS = [
    {"id": "first_workout", "xp": 100, "cond": "workouts>=1"},
    {"id": "ten_workouts", "xp": 250, "cond": "workouts>=10"},
    {"id": "fifty_workouts", "xp": 500, "cond": "workouts>=50"},
    {"id": "streak_7", "xp": 200, "cond": "streak>=7"},
    {"id": "streak_30", "xp": 750, "cond": "streak>=30"},
    {"id": "volume_10k", "xp": 300, "cond": "volume>=10000"},
    {"id": "early_bird", "xp": 150, "cond": "workouts>=5"},
]


@api.post("/sessions/start")
async def start_session(body: SessionStart, user: dict = Depends(get_current_user)):
    active = await db.sessions.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
    if active:
        return active
    exercises = body.exercises or []
    name = body.name or "Workout"
    if body.plan_id is not None and body.day_index is not None:
        plan = await db.plans.find_one({"id": body.plan_id, "user_id": user["id"]}, {"_id": 0})
        if plan and 0 <= body.day_index < len(plan.get("days", [])):
            day = plan["days"][body.day_index]
            name = f"{plan['name']} · {day['name']}"
            exercises = []
            for pe in day.get("exercises", []):
                sets = [{"reps": pe.get("reps", 10), "weight": pe.get("weight", 0),
                         "done": False, "warmup": False, "rpe": pe.get("rpe")}
                        for _ in range(int(pe.get("sets", 3)))]
                exercises.append({
                    "exercise_id": pe["exercise_id"], "name": pe.get("name", ""),
                    "primary_muscle": pe.get("primary_muscle"), "rest": pe.get("rest", 90),
                    "notes": pe.get("notes", ""), "sets": sets})
    session = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "name": name,
        "plan_id": body.plan_id, "day_index": body.day_index,
        "status": "active", "exercises": exercises,
        "started_at": iso(now_utc()), "finished_at": None,
        "duration_sec": 0, "total_volume": 0, "total_sets": 0}
    await db.sessions.insert_one(dict(session))
    session.pop("_id", None)
    return session


@api.get("/sessions/active")
async def get_active(user: dict = Depends(get_current_user)):
    active = await db.sessions.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
    return active or {}


@api.put("/sessions/{sid}")
async def update_session(sid: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    allowed = {k: body[k] for k in ("exercises", "name") if k in body}
    if not allowed:
        raise HTTPException(400, "Nothing to update")
    res = await db.sessions.update_one(
        {"id": sid, "user_id": user["id"], "status": "active"}, {"$set": allowed})
    if res.matched_count == 0:
        raise HTTPException(404, "Active session not found")
    return await db.sessions.find_one({"id": sid}, {"_id": 0})


@api.post("/sessions/{sid}/cancel")
async def cancel_session(sid: str, user: dict = Depends(get_current_user)):
    await db.sessions.update_one(
        {"id": sid, "user_id": user["id"], "status": "active"},
        {"$set": {"status": "cancelled", "finished_at": iso(now_utc())}})
    return {"ok": True}


def _compute_level(xp: int) -> int:
    return 1 + xp // 500


def _next_streak(user: dict) -> int:
    today = now_utc().date()
    last = user.get("last_workout_date")
    streak = user.get("streak", 0)
    if last:
        try:
            last_d = datetime.fromisoformat(last).date()
        except ValueError:
            last_d = None
        if last_d == today:
            return streak
        if last_d == today - timedelta(days=1):
            return streak + 1
        return 1
    return 1


@api.post("/sessions/{sid}/finish")
async def finish_session(sid: str, body: Optional[Dict[str, Any]] = None, user: dict = Depends(get_current_user)):
    session = await db.sessions.find_one({"id": sid, "user_id": user["id"], "status": "active"}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Active session not found")
    if body and "exercises" in body:
        session["exercises"] = body["exercises"]
    total_volume = 0.0
    total_sets = 0
    for se in session.get("exercises", []):
        for st in se.get("sets", []):
            if st.get("done") and not st.get("warmup"):
                total_volume += (st.get("weight") or 0) * (st.get("reps") or 0)
                total_sets += 1
    try:
        duration = int((now_utc() - datetime.fromisoformat(session["started_at"])).total_seconds())
    except Exception:
        duration = (body or {}).get("duration_sec", 0)
    finished_at = iso(now_utc())
    prs: List[dict] = []
    for se in session.get("exercises", []):
        ex_id = se.get("exercise_id")
        top = 0.0
        for st in se.get("sets", []):
            if st.get("done") and not st.get("warmup"):
                top = max(top, st.get("weight") or 0)
        if top <= 0:
            continue
        prev = await db.prs.find_one({"user_id": user["id"], "exercise_id": ex_id})
        if not prev or top > prev.get("weight", 0):
            await db.prs.update_one(
                {"user_id": user["id"], "exercise_id": ex_id},
                {"$set": {"weight": top, "date": finished_at, "name": se.get("name", "")}}, upsert=True)
            prs.append({"exercise_id": ex_id, "weight": top})
    await db.sessions.update_one({"id": sid}, {"$set": {
        "status": "completed", "finished_at": finished_at, "duration_sec": duration,
        "total_volume": total_volume, "total_sets": total_sets, "prs": prs,
        "exercises": session["exercises"]}})
    workouts = await db.sessions.count_documents({"user_id": user["id"], "status": "completed"})
    streak = _next_streak(user)
    gained = 50 + total_sets * 5 + len(prs) * 25
    xp = user.get("xp", 0) + gained
    achieved = set(user.get("achievements", []))
    newly = []
    ctx = {"workouts": workouts, "streak": streak, "volume": total_volume}
    for a in ACHIEVEMENTS:
        if a["id"] in achieved:
            continue
        field, _, val = re.match(r"(\w+)(>=)(\d+)", a["cond"]).groups()
        if ctx.get(field, 0) >= int(val):
            achieved.add(a["id"])
            newly.append(a["id"])
            xp += a["xp"]
    best_streak = max(user.get("best_streak", 0), streak)
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "xp": xp, "level": _compute_level(xp), "streak": streak,
        "best_streak": best_streak, "achievements": list(achieved),
        "last_workout_date": finished_at}})
    return {"ok": True, "xp_gained": gained, "new_achievements": newly, "prs": prs,
            "total_volume": total_volume, "total_sets": total_sets,
            "streak": streak, "level": _compute_level(xp)}


@api.get("/sessions")
async def list_sessions(limit: int = 50, user: dict = Depends(get_current_user)):
    items = await db.sessions.find(
        {"user_id": user["id"], "status": "completed"}, {"_id": 0}).sort("finished_at", -1).to_list(limit)
    return {"items": items}


@api.get("/sessions/{sid}")
async def get_session(sid: str, user: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Session not found")
    return s


# --------------------------------------------------------------------------- #
# Progress / measurements
# --------------------------------------------------------------------------- #
@api.post("/measurements")
async def add_measurement(body: MeasurementIn, user: dict = Depends(get_current_user)):
    m = {"id": str(uuid.uuid4()), "user_id": user["id"],
         **body.model_dump(exclude_none=True), "created_at": iso(now_utc())}
    m.setdefault("date", iso(now_utc()))
    await db.measurements.insert_one(dict(m))
    if body.weight_kg:
        await db.users.update_one({"id": user["id"]}, {"$set": {"weight_kg": body.weight_kg}})
    m.pop("_id", None)
    return m


@api.get("/measurements")
async def list_measurements(user: dict = Depends(get_current_user)):
    items = await db.measurements.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(2000)
    return {"items": items}


@api.get("/prs")
async def list_prs(user: dict = Depends(get_current_user)):
    items = await db.prs.find({"user_id": user["id"]}, {"_id": 0}).sort("weight", -1).to_list(200)
    return {"items": items}


def bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "underweight"
    if bmi < 25:
        return "normal"
    if bmi < 30:
        return "overweight"
    return "obese"


@api.get("/progress/summary")
async def progress_summary(user: dict = Depends(get_current_user)):
    measurements = await db.measurements.find(
        {"user_id": user["id"], "weight_kg": {"$ne": None}}, {"_id": 0}).sort("date", 1).to_list(2000)
    weights = [{"date": m["date"], "weight": m["weight_kg"]} for m in measurements if m.get("weight_kg")]
    height = user.get("height_cm")
    current_weight = weights[-1]["weight"] if weights else user.get("weight_kg")
    bmi = None
    bmi_cat = None
    if height and current_weight:
        bmi = round(current_weight / ((height / 100) ** 2), 1)
        bmi_cat = bmi_category(bmi)
    target = user.get("target_weight_kg")
    goal_info = None
    if target and current_weight is not None:
        diff = round(current_weight - target, 1)
        trend = None
        eta_weeks = None
        if len(weights) >= 2:
            try:
                d0 = datetime.fromisoformat(weights[0]["date"]).date()
                d1 = datetime.fromisoformat(weights[-1]["date"]).date()
                days = max((d1 - d0).days, 1)
                rate = (weights[-1]["weight"] - weights[0]["weight"]) / days
                trend = round(rate * 7, 2)
                if rate != 0 and ((diff > 0 and rate < 0) or (diff < 0 and rate > 0)):
                    eta_weeks = round(abs((current_weight - target) / (rate * 7)))
            except Exception:
                pass
        goal_info = {"current": current_weight, "target": target, "difference": diff,
                     "trend_per_week": trend, "eta_weeks": eta_weeks}
    sessions = await db.sessions.find({"user_id": user["id"], "status": "completed"}, {"_id": 0}).to_list(2000)
    total_volume = sum(s.get("total_volume", 0) for s in sessions)
    freq: Dict[str, int] = {}
    vol_series = []
    for s in sessions:
        if not s.get("finished_at"):
            continue
        try:
            d = datetime.fromisoformat(s["finished_at"]).date()
        except Exception:
            continue
        wk = d.isocalendar()
        key = f"{wk[0]}-W{wk[1]:02d}"
        freq[key] = freq.get(key, 0) + 1
        vol_series.append({"date": s["finished_at"], "volume": s.get("total_volume", 0)})
    vol_series.sort(key=lambda x: x["date"])
    return {
        "bmi": bmi, "bmi_category": bmi_cat,
        "bmi_range": {"min_weight": round(18.5 * ((height / 100) ** 2), 1) if height else None,
                      "max_weight": round(24.9 * ((height / 100) ** 2), 1) if height else None},
        "current_weight": current_weight, "weights": weights, "goal": goal_info,
        "total_workouts": len(sessions), "total_volume": total_volume,
        "frequency": [{"week": k, "count": v} for k, v in sorted(freq.items())],
        "volume_series": vol_series,
        "streak": user.get("streak", 0), "best_streak": user.get("best_streak", 0),
    }


# --------------------------------------------------------------------------- #
# Gamification & leaderboard
# --------------------------------------------------------------------------- #
@api.get("/gamification")
async def gamification(user: dict = Depends(get_current_user)):
    xp = user.get("xp", 0)
    level = _compute_level(xp)
    into = xp - (level - 1) * 500
    workouts = await db.sessions.count_documents({"user_id": user["id"], "status": "completed"})
    week_start = now_utc().date() - timedelta(days=now_utc().date().weekday())
    sessions = await db.sessions.find({"user_id": user["id"], "status": "completed"}, {"_id": 0}).to_list(2000)
    w_count = 0
    w_vol = 0.0
    for s in sessions:
        try:
            d = datetime.fromisoformat(s["finished_at"]).date()
        except Exception:
            continue
        if d >= week_start:
            w_count += 1
            w_vol += s.get("total_volume", 0)
    challenges = [
        {"id": "weekly_3", "target": 3, "progress": w_count, "metric": "workouts_this_week"},
        {"id": "volume_5k", "target": 5000, "progress": round(w_vol), "metric": "volume_this_week"},
    ]
    return {"xp": xp, "level": level, "xp_into_level": into, "xp_for_next": 500,
            "streak": user.get("streak", 0), "best_streak": user.get("best_streak", 0),
            "achievements": user.get("achievements", []),
            "all_achievements": [a["id"] for a in ACHIEVEMENTS],
            "total_workouts": workouts, "challenges": challenges}


@api.put("/users/me/leaderboard-optin")
async def leaderboard_optin(body: Dict[str, bool], user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"leaderboard_optin": bool(body.get("optin"))}})
    return {"optin": bool(body.get("optin"))}


@api.get("/leaderboard")
async def leaderboard(metric: str = "xp", user: dict = Depends(get_current_user)):
    if not user.get("leaderboard_optin"):
        return {"opted_in": False, "items": []}
    field = {"xp": "xp", "streak": "best_streak"}.get(metric, "xp")
    users = await db.users.find({"leaderboard_optin": True, "deleted_at": None}, {"_id": 0}).to_list(500)
    if metric == "workouts":
        for u in users:
            u["_wc"] = await db.sessions.count_documents({"user_id": u["id"], "status": "completed"})
        users.sort(key=lambda u: u["_wc"], reverse=True)
        items = [{"name": u["name"], "value": u["_wc"], "level": u.get("level", 1),
                  "is_me": u["id"] == user["id"]} for u in users[:50]]
    else:
        users.sort(key=lambda u: u.get(field, 0), reverse=True)
        items = [{"name": u["name"], "value": u.get(field, 0), "level": u.get("level", 1),
                  "is_me": u["id"] == user["id"]} for u in users[:50]]
    return {"opted_in": True, "metric": metric, "items": items}


# --------------------------------------------------------------------------- #
# Food tracking (Open Food Facts proxy)
# --------------------------------------------------------------------------- #
OFF_HEADERS = {"User-Agent": "GymBuddy/1.0 (contact@gymbuddy.app)"}


def _off_product(p: dict) -> dict:
    n = p.get("nutriments", {})

    def num(k):
        try:
            return round(float(n.get(k)), 1)
        except (TypeError, ValueError):
            return 0.0
    return {
        "barcode": p.get("code") or p.get("_id"),
        "name": p.get("product_name") or p.get("generic_name") or "Unknown product",
        "brand": (p.get("brands") or "").split(",")[0].strip(),
        "calories": num("energy-kcal_100g"), "protein": num("proteins_100g"),
        "carbs": num("carbohydrates_100g"), "fat": num("fat_100g"),
        "serving": "100g", "image": p.get("image_front_small_url") or p.get("image_url"),
    }


@api.get("/food/search")
async def food_search(q: str, user: dict = Depends(get_current_user)):
    if not q.strip():
        return {"items": []}
    url = "https://world.openfoodfacts.org/cgi/search.pl"
    params = {"search_terms": q, "search_simple": 1, "action": "process", "json": 1, "page_size": 25,
              "fields": "code,product_name,generic_name,brands,nutriments,image_front_small_url,image_url"}
    try:
        async with httpx.AsyncClient(timeout=12, headers=OFF_HEADERS) as c:
            r = await c.get(url, params=params)
            data = r.json()
        return {"items": [_off_product(p) for p in data.get("products", []) if p.get("product_name")]}
    except Exception as e:
        logger.warning("OFF search failed: %s", e)
        return {"items": [], "error": "food_service_unavailable"}


@api.get("/food/barcode/{code}")
async def food_barcode(code: str, user: dict = Depends(get_current_user)):
    url = f"https://world.openfoodfacts.org/api/v2/product/{code}.json"
    try:
        async with httpx.AsyncClient(timeout=12, headers=OFF_HEADERS) as c:
            r = await c.get(url)
            data = r.json()
        if data.get("status") == 1 and data.get("product"):
            return {"found": True, "product": _off_product(data["product"])}
        return {"found": False}
    except Exception as e:
        logger.warning("OFF barcode failed: %s", e)
        raise HTTPException(503, "Food service unavailable")


@api.post("/food/custom")
async def create_custom_food(body: CustomFoodIn, user: dict = Depends(get_current_user)):
    f = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(), "created_at": iso(now_utc())}
    await db.custom_foods.insert_one(dict(f))
    f.pop("_id", None)
    return f


@api.get("/food/custom")
async def list_custom_foods(user: dict = Depends(get_current_user)):
    items = await db.custom_foods.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": items}


@api.post("/food/entries")
async def add_food_entry(body: FoodEntryIn, user: dict = Depends(get_current_user)):
    e = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump()}
    if not e.get("date"):
        e["date"] = now_utc().date().isoformat()
    e["date"] = e["date"][:10]
    e["created_at"] = iso(now_utc())
    await db.food_entries.insert_one(dict(e))
    e.pop("_id", None)
    return e


@api.get("/food/entries")
async def list_food_entries(date: str = "", user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if date:
        q["date"] = date[:10]
    items = await db.food_entries.find(q, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return {"items": items}


@api.delete("/food/entries/{eid}")
async def delete_food_entry(eid: str, user: dict = Depends(get_current_user)):
    await db.food_entries.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/food/summary")
async def food_summary(date: str = "", user: dict = Depends(get_current_user)):
    d = (date[:10] if date else now_utc().date().isoformat())
    items = await db.food_entries.find({"user_id": user["id"], "date": d}, {"_id": 0}).to_list(1000)
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    for it in items:
        qy = it.get("quantity", 1) or 1
        totals["calories"] += (it.get("calories", 0) or 0) * qy
        totals["protein"] += (it.get("protein", 0) or 0) * qy
        totals["carbs"] += (it.get("carbs", 0) or 0) * qy
        totals["fat"] += (it.get("fat", 0) or 0) * qy
    return {"date": d, "totals": {k: round(v, 1) for k, v in totals.items()},
            "count": len(items), "entries": items}


@api.get("/food/favorites")
async def list_favorites(user: dict = Depends(get_current_user)):
    items = await db.food_favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    return {"items": items}


@api.post("/food/favorites")
async def add_favorite(body: CustomFoodIn, user: dict = Depends(get_current_user)):
    f = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(), "created_at": iso(now_utc())}
    await db.food_favorites.insert_one(dict(f))
    f.pop("_id", None)
    return f


@api.delete("/food/favorites/{fid}")
async def remove_favorite(fid: str, user: dict = Depends(get_current_user)):
    await db.food_favorites.delete_one({"id": fid, "user_id": user["id"]})
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Weekly overview
# --------------------------------------------------------------------------- #
@api.get("/week")
async def week_overview(user: dict = Depends(get_current_user)):
    start = now_utc().date() - timedelta(days=now_utc().date().weekday())
    sessions = await db.sessions.find({"user_id": user["id"], "status": "completed"}, {"_id": 0}).to_list(2000)
    by_day: Dict[str, dict] = {}
    for s in sessions:
        try:
            d = datetime.fromisoformat(s["finished_at"]).date()
        except Exception:
            continue
        if start <= d <= start + timedelta(days=6):
            e = by_day.setdefault(d.isoformat(), {"count": 0, "duration": 0, "volume": 0})
            e["count"] += 1
            e["duration"] += s.get("duration_sec", 0)
            e["volume"] += s.get("total_volume", 0)
    training_days = user.get("training_days", [])
    day_slugs = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    days = []
    for i in range(7):
        d = start + timedelta(days=i)
        completed = by_day.get(d.isoformat())
        days.append({"date": d.isoformat(), "weekday": day_slugs[i],
                     "planned": day_slugs[i] in training_days,
                     "completed": completed["count"] if completed else 0,
                     "duration_sec": completed["duration"] if completed else 0,
                     "volume": completed["volume"] if completed else 0})
    return {"week_start": start.isoformat(), "days": days}


# --------------------------------------------------------------------------- #
# Admin
# --------------------------------------------------------------------------- #
@api.get("/admin/overview")
async def admin_overview(admin: dict = Depends(require_admin)):
    return {"total_users": await db.users.count_documents({"deleted_at": None}),
            "total_exercises": len(EXERCISES), "total_templates": len(TEMPLATES),
            "total_completed_workouts": await db.sessions.count_documents({"status": "completed"}),
            "total_plans": await db.plans.count_documents({"deleted_at": None}),
            "is_root": admin.get("root_admin", False)}


@api.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return {"items": users}


class RoleChange(BaseModel):
    action: str


@api.patch("/admin/users/{uid}/role")
async def admin_change_role(uid: str, body: RoleChange, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("root_admin"):
        raise HTTPException(403, "The root admin cannot be modified.")
    if body.action == "promote":
        await db.users.update_one({"id": uid}, {"$set": {"role": "admin"}})
    elif body.action == "demote":
        if not admin.get("root_admin"):
            raise HTTPException(403, "Only the root admin can revoke admin rights.")
        await db.users.update_one({"id": uid}, {"$set": {"role": "user"}})
    else:
        raise HTTPException(400, "Invalid action")
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


@api.patch("/admin/users/{uid}/disable")
async def admin_disable_user(uid: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("root_admin"):
        raise HTTPException(403, "The root admin cannot be disabled.")
    new_state = None if target.get("deleted_at") else iso(now_utc())
    await db.users.update_one({"id": uid}, {"$set": {"deleted_at": new_state}})
    return {"ok": True, "disabled": new_state is not None}


@api.get("/admin/audit")
async def admin_media_audit(admin: dict = Depends(require_admin)):
    no_image, no_demo, invalid_equip, missing_tr, duplicates = [], [], [], [], []
    seen = {}
    for ex in EXERCISES:
        if not ex.get("has_image"):
            no_image.append(ex["id"])
        if not ex.get("has_animation"):
            no_demo.append(ex["id"])
        for eq in ex["required_equipment"]:
            if eq not in EQUIP_SET:
                invalid_equip.append({"id": ex["id"], "equipment": eq})
        for lang in LANGS:
            if not ex["localized_names"].get(lang):
                missing_tr.append({"id": ex["id"], "lang": lang})
        key = ex["name"].lower() + "|" + ",".join(sorted(ex["required_equipment"]))
        if key in seen:
            duplicates.append({"id": ex["id"], "duplicate_of": seen[key]})
        else:
            seen[key] = ex["id"]
    return {
        "exercises_without_image": {"count": len(no_image), "sample": no_image[:20]},
        "exercises_without_demonstration": {"count": len(no_demo), "sample": no_demo[:20]},
        "invalid_equipment_mappings": {"count": len(invalid_equip), "items": invalid_equip[:20]},
        "missing_translations": {"count": len(missing_tr), "items": missing_tr[:20]},
        "duplicate_exercises": {"count": len(duplicates), "items": duplicates[:20]},
        "total_exercises": len(EXERCISES)}


@api.get("/admin/reports")
async def admin_reports(admin: dict = Depends(require_admin)):
    from collections import Counter
    return {
        "exercises_by_category": dict(Counter(e["category"] for e in EXERCISES)),
        "exercises_by_difficulty": dict(Counter(e["difficulty"] for e in EXERCISES)),
        "active_users": await db.users.count_documents({"deleted_at": None}),
        "completed_workouts": await db.sessions.count_documents({"status": "completed"})}


@api.get("/admin/config")
async def admin_get_config(admin: dict = Depends(require_admin)):
    cfg = await db.config.find_one({"id": "app"}, {"_id": 0})
    return cfg or {"id": "app", "maintenance": False, "default_language": "en",
                   "premium_enabled": True, "leaderboards_enabled": True}


@api.put("/admin/config")
async def admin_set_config(body: Dict[str, Any], admin: dict = Depends(require_admin)):
    body["id"] = "app"
    await db.config.update_one({"id": "app"}, {"$set": body}, upsert=True)
    return await db.config.find_one({"id": "app"}, {"_id": 0})


@api.patch("/admin/exercises/{ex_id}")
async def admin_edit_exercise(ex_id: str, body: Dict[str, Any], admin: dict = Depends(require_admin)):
    ex = EX_BY_ID.get(ex_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    allowed = {k: body[k] for k in ("is_active", "has_image", "has_animation", "media_attribution") if k in body}
    for k in ("is_active", "has_image", "has_animation"):
        if k in allowed:
            ex[k] = allowed[k]
    await db.exercise_overrides.update_one({"id": ex_id}, {"$set": {"id": ex_id, **allowed}}, upsert=True)
    return {"ok": True, "exercise": {"id": ex_id, **allowed}}


# --------------------------------------------------------------------------- #
# Subscription (no payment; prepared)
# --------------------------------------------------------------------------- #
@api.get("/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    return {"tier": user.get("subscription", "free"), "plans": [
        {"id": "free", "price": 0, "features": ["basic_plans", "exercise_db", "tracking", "food_basic"]},
        {"id": "premium", "price": 0, "features": ["advanced_stats", "extra_plans", "advanced_generation",
                                                   "extended_history", "custom_themes"]}]}


@api.post("/subscription/set")
async def set_subscription(body: Dict[str, str], user: dict = Depends(get_current_user)):
    tier = body.get("tier", "free")
    if tier not in ("free", "premium"):
        raise HTTPException(400, "Invalid tier")
    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription": tier}})
    return {"tier": tier}


# --------------------------------------------------------------------------- #
# Gallery (public/private progress photos)
# --------------------------------------------------------------------------- #
class GalleryIn(BaseModel):
    image: str
    caption: Optional[str] = ""
    visibility: str = "private"


class GalleryUpdate(BaseModel):
    caption: Optional[str] = None
    visibility: Optional[str] = None


@api.post("/gallery")
async def add_gallery(body: GalleryIn, user: dict = Depends(get_current_user)):
    vis = "public" if body.visibility == "public" else "private"
    g = {"id": str(uuid.uuid4()), "user_id": user["id"], "image": body.image,
         "caption": (body.caption or "").strip(), "visibility": vis,
         "created_at": iso(now_utc()), "deleted_at": None}
    await db.gallery.insert_one(dict(g))
    g.pop("_id", None)
    return g


@api.get("/gallery")
async def list_gallery(user: dict = Depends(get_current_user)):
    items = await db.gallery.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": items}


@api.patch("/gallery/{gid}")
async def update_gallery(gid: str, body: GalleryUpdate, user: dict = Depends(get_current_user)):
    upd = {}
    if body.caption is not None:
        upd["caption"] = body.caption.strip()
    if body.visibility is not None:
        upd["visibility"] = "public" if body.visibility == "public" else "private"
    if upd:
        await db.gallery.update_one({"id": gid, "user_id": user["id"]}, {"$set": upd})
    return await db.gallery.find_one({"id": gid, "user_id": user["id"]}, {"_id": 0})


@api.delete("/gallery/{gid}")
async def delete_gallery(gid: str, user: dict = Depends(get_current_user)):
    await db.gallery.update_one({"id": gid, "user_id": user["id"]}, {"$set": {"deleted_at": iso(now_utc())}})
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Social feed (public profiles only)
# --------------------------------------------------------------------------- #
class PostIn(BaseModel):
    text: str = ""
    image: Optional[str] = None
    type: str = "text"  # text | photo | record
    record: Optional[str] = None
    visibility: str = "public"


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


async def _author_card(uid: str) -> dict:
    u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1, "avatar": 1, "level": 1, "privacy": 1, "id": 1})
    if not u:
        return {"id": uid, "name": "Unknown", "avatar": None, "level": 1, "public": False}
    return {"id": uid, "name": u.get("name"), "avatar": u.get("avatar"),
            "level": u.get("level", 1), "public": bool((u.get("privacy") or {}).get("profile_public"))}


def _post_public(p: dict, me: str, author: dict) -> dict:
    return {"id": p["id"], "text": p.get("text", ""), "image": p.get("image"),
            "type": p.get("type", "text"), "record": p.get("record"),
            "created_at": p.get("created_at"), "author": author,
            "likes": len(p.get("likes", [])), "liked": me in p.get("likes", []),
            "comments": len(p.get("comments", []))}


@api.post("/posts")
async def create_post(body: PostIn, user: dict = Depends(get_current_user)):
    p = {"id": str(uuid.uuid4()), "user_id": user["id"], "text": body.text.strip()[:1000],
         "image": body.image, "type": body.type, "record": body.record,
         "visibility": "public" if body.visibility == "public" else "private",
         "likes": [], "comments": [], "created_at": iso(now_utc()), "deleted_at": None}
    await db.posts.insert_one(dict(p))
    return _post_public(p, user["id"], await _author_card(user["id"]))


@api.get("/feed")
async def feed(offset: int = 0, limit: int = 20, user: dict = Depends(get_current_user)):
    # public posts only, and only from users with a public profile
    public_ids = [u["id"] async for u in db.users.find({"privacy.profile_public": True, "deleted_at": None}, {"id": 1})]
    cursor = db.posts.find({"visibility": "public", "deleted_at": None, "user_id": {"$in": public_ids}}, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit)
    posts = await cursor.to_list(limit)
    out = []
    cache: Dict[str, dict] = {}
    for p in posts:
        if p["user_id"] not in cache:
            cache[p["user_id"]] = await _author_card(p["user_id"])
        out.append(_post_public(p, user["id"], cache[p["user_id"]]))
    return {"items": out}


@api.get("/explore")
async def explore(offset: int = 0, limit: int = 30, user: dict = Depends(get_current_user)):
    # Instagram-style explore: public image posts from users with public profiles
    public_ids = [u["id"] async for u in db.users.find({"privacy.profile_public": True, "deleted_at": None}, {"id": 1})]
    cursor = db.posts.find(
        {"visibility": "public", "deleted_at": None, "user_id": {"$in": public_ids}, "image": {"$ne": None}},
        {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit)
    posts = await cursor.to_list(limit)
    return {"items": [{"id": p["id"], "image": p.get("image"),
                       "likes": len(p.get("likes", [])), "comments": len(p.get("comments", []))} for p in posts]}


@api.get("/posts/{pid}")
async def get_post(pid: str, user: dict = Depends(get_current_user)):
    p = await db.posts.find_one({"id": pid, "deleted_at": None}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Post not found")
    author = await _author_card(p["user_id"])
    if p.get("visibility") != "public" and p["user_id"] != user["id"]:
        raise HTTPException(403, "Private post")
    data = _post_public(p, user["id"], author)
    comments = []
    for c in p.get("comments", []):
        comments.append({**c, "author": await _author_card(c["user_id"])})
    data["comment_list"] = comments
    return data


@api.post("/posts/{pid}/like")
async def like_post(pid: str, user: dict = Depends(get_current_user)):
    p = await db.posts.find_one({"id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Post not found")
    likes = set(p.get("likes", []))
    if user["id"] in likes:
        likes.discard(user["id"])
    else:
        likes.add(user["id"])
    await db.posts.update_one({"id": pid}, {"$set": {"likes": list(likes)}})
    return {"likes": len(likes), "liked": user["id"] in likes}


@api.post("/posts/{pid}/comments")
async def comment_post(pid: str, body: CommentIn, user: dict = Depends(get_current_user)):
    p = await db.posts.find_one({"id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Post not found")
    c = {"id": str(uuid.uuid4()), "user_id": user["id"], "text": body.text.strip(), "created_at": iso(now_utc())}
    await db.posts.update_one({"id": pid}, {"$push": {"comments": c}})
    return {**c, "author": await _author_card(user["id"])}


def _find_comment(post: dict, cid: str) -> Optional[dict]:
    return next((c for c in post.get("comments", []) if c.get("id") == cid), None)


def _can_manage_comment(comment: dict, user: dict) -> bool:
    return comment["user_id"] == user["id"] or user.get("role") == "admin"


@api.put("/posts/{pid}/comments/{cid}")
async def edit_comment(pid: str, cid: str, body: CommentIn, user: dict = Depends(get_current_user)):
    p = await db.posts.find_one({"id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Post not found")
    c = _find_comment(p, cid)
    if not c:
        raise HTTPException(404, "Comment not found")
    if not _can_manage_comment(c, user):
        raise HTTPException(403, "Not allowed")
    await db.posts.update_one({"id": pid, "comments.id": cid},
                              {"$set": {"comments.$.text": body.text.strip(), "comments.$.edited_at": iso(now_utc())}})
    return {"ok": True}


@api.delete("/posts/{pid}/comments/{cid}")
async def delete_comment(pid: str, cid: str, user: dict = Depends(get_current_user)):
    p = await db.posts.find_one({"id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Post not found")
    c = _find_comment(p, cid)
    if not c:
        raise HTTPException(404, "Comment not found")
    if not _can_manage_comment(c, user):
        raise HTTPException(403, "Not allowed")
    await db.posts.update_one({"id": pid}, {"$pull": {"comments": {"id": cid}}})
    return {"ok": True}



@api.delete("/posts/{pid}")
async def delete_post(pid: str, user: dict = Depends(get_current_user)):
    await db.posts.update_one({"id": pid, "user_id": user["id"]}, {"$set": {"deleted_at": iso(now_utc())}})
    return {"ok": True}


@api.get("/posts/mine/list")
async def my_posts(user: dict = Depends(get_current_user)):
    posts = await db.posts.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    author = await _author_card(user["id"])
    return {"items": [_post_public(p, user["id"], author) for p in posts]}


@api.get("/users/search")
async def search_users(q: str = "", user: dict = Depends(get_current_user)):
    if not q.strip():
        return {"items": []}
    # ONLY public profiles are searchable
    rx = {"$regex": re.escape(q.strip()), "$options": "i"}
    users = await db.users.find(
        {"privacy.profile_public": True, "deleted_at": None, "name": rx}, {"_id": 0}).limit(30).to_list(30)
    return {"items": [{"id": u["id"], "name": u["name"], "avatar": u.get("avatar"),
                       "level": u.get("level", 1), "best_streak": u.get("best_streak", 0)} for u in users]}


@api.get("/users/{uid}/profile")
async def public_profile(uid: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": uid, "deleted_at": None})
    if not u:
        raise HTTPException(404, "User not found")
    is_self = uid == user["id"]
    if not (u.get("privacy") or {}).get("profile_public") and not is_self:
        raise HTTPException(403, "This profile is private")
    workouts = await db.sessions.count_documents({"user_id": uid, "status": "completed"})
    posts = await db.posts.find({"user_id": uid, "visibility": "public", "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(50)
    photos = await db.gallery.find({"user_id": uid, "visibility": "public", "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(50)
    author = await _author_card(uid)
    # Never expose weight, measurements, target, private photos
    return {"id": uid, "name": u["name"], "avatar": u.get("avatar"), "level": u.get("level", 1),
            "xp": u.get("xp", 0), "best_streak": u.get("best_streak", 0), "total_workouts": workouts,
            "is_self": is_self, "posts": [_post_public(p, user["id"], author) for p in posts],
            "photos": photos}


@api.get("/")
async def root():
    return {"app": "GymBuddy", "status": "ok", "exercises": len(EXERCISES)}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.sessions.create_index([("user_id", 1), ("status", 1)])
    await db.measurements.create_index([("user_id", 1), ("date", 1)])
    await db.food_entries.create_index([("user_id", 1), ("date", 1)])
    async for ov in db.exercise_overrides.find({}):
        ex = EX_BY_ID.get(ov.get("id"))
        if ex:
            for k in ("is_active", "has_image", "has_animation"):
                if k in ov:
                    ex[k] = ov[k]
    existing = await db.users.find_one({"email": ROOT_ADMIN_EMAIL})
    if existing:
        await db.users.update_one({"email": ROOT_ADMIN_EMAIL},
                                  {"$set": {"role": "admin", "root_admin": True, "deleted_at": None}})
    else:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "name": "Admin", "email": ROOT_ADMIN_EMAIL,
            "password_hash": hash_pw(ROOT_ADMIN_PASSWORD), "role": "admin", "root_admin": True,
            "onboarded": True, "date_of_birth": None, "gender": None, "height_cm": 180,
            "weight_kg": 80, "target_weight_kg": 78, "goal": "build_muscle",
            "experience": "advanced", "training_days": ["mon", "wed", "fri"],
            "workout_duration_min": 60, "equipment": list(EQUIP_SET), "units": "metric",
            "language": "en", "avatar": None, "notifications": DEFAULT_NOTIFS,
            "privacy": DEFAULT_PRIVACY, "leaderboard_optin": True, "subscription": "premium",
            "xp": 0, "level": 1, "streak": 0, "best_streak": 0, "achievements": [],
            "last_workout_date": None, "created_at": iso(now_utc()), "deleted_at": None})
    logger.info("GymBuddy started with %d exercises", len(EXERCISES))


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
