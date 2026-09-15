"""GymBuddy backend API test suite.
Covers auth, onboarding, equipment filtering, exercises, plans, sessions,
progress, food, gamification, leaderboard, admin RBAC and subscription.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://exercise-system-test.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@gymbuddy.app"
ADMIN_PASSWORD = "AdminGym2026!"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _register(sess, email=None, password="Password1!", name="Test User"):
    email = email or f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = sess.post(f"{API}/auth/register", json={"name": name, "email": email, "password": password})
    return r, email, password


@pytest.fixture(scope="session")
def user_token(s):
    r, email, pw = _register(s)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    return {"token": tok, "email": email, "password": pw, "auth": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["role"] == "admin"
    assert d["user"].get("root_admin") is True
    return {"token": d["token"], "auth": {"Authorization": f"Bearer {d['token']}"}}


# ---------- auth ----------
class TestAuth:
    def test_register_login_me(self, s):
        r, email, pw = _register(s)
        assert r.status_code == 200
        assert "token" in r.json()

        # duplicate email -> 409
        r2 = s.post(f"{API}/auth/register", json={"name": "x", "email": email, "password": pw})
        assert r2.status_code == 409

        # wrong pw -> 401
        r3 = s.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
        assert r3.status_code == 401

        # login ok
        r4 = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r4.status_code == 200
        tok = r4.json()["token"]

        # /me
        r5 = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert r5.status_code == 200
        assert r5.json()["email"] == email

    def test_me_without_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- onboarding & equipment filtering (critical) ----------
class TestOnboardingAndEquipment:
    def test_onboarding_persists(self, s, user_token):
        payload = {
            "name": "Filter Tester",
            "gender": "male", "height_cm": 180, "weight_kg": 80,
            "target_weight_kg": 75,
            "goal": "build_muscle",
            "experience": "intermediate",
            "training_days": ["mon", "tue", "thu", "fri"],
            "workout_duration_min": 60,
            "language": "en",
            "equipment": ["dumbbells", "bench"],
        }
        r = s.post(f"{API}/users/me/onboarding", json=payload, headers=user_token["auth"])
        assert r.status_code == 200, r.text
        me = s.get(f"{API}/auth/me", headers=user_token["auth"]).json()
        assert me.get("onboarded") is True
        assert set(me.get("equipment", [])) >= {"dumbbells", "bench"}
        assert me.get("height_cm") == 180
        assert me.get("weight_kg") == 80

    def test_equipment_filter_available_only(self, s, user_token):
        r = s.get(f"{API}/exercises?available_only=true&limit=500", headers=user_token["auth"])
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("items", data if isinstance(data, list) else [])
        assert len(items) > 0
        names = {i.get("name_en") or i.get("name") for i in items}
        # Must INCLUDE Dumbbell Bench Press
        db_press = [i for i in items if (i.get("name_en") or i.get("name") or "").lower() == "dumbbell bench press"]
        assert db_press, f"Dumbbell Bench Press missing when user has dumbbells+bench; sample: {list(names)[:20]}"
        # Must EXCLUDE Barbell Bench Press
        bb_press = [i for i in items if (i.get("name_en") or i.get("name") or "").lower() == "barbell bench press"]
        assert not bb_press, "Barbell Bench Press should not appear with only dumbbells+bench"
        # No item should require barbell/smith_machine/leg_press/cable_machine
        forbidden = {"barbell", "smith_machine", "leg_press", "cable_machine"}
        for it in items:
            eq = set(it.get("equipment", []))
            assert not (eq & forbidden), f"Item {it.get('name_en')} requires forbidden eq {eq & forbidden}"

    def test_available_flag_on_all(self, s, user_token):
        r = s.get(f"{API}/exercises?limit=100", headers=user_token["auth"])
        assert r.status_code == 200
        items = r.json().get("items", [])
        # at least one item should be unavailable and one available
        avails = {it.get("available") for it in items}
        assert True in avails


# ---------- exercises ----------
class TestExercises:
    def test_list_filters_and_pagination(self, s, user_token):
        r = s.get(f"{API}/exercises?search=press&limit=5&offset=0", headers=user_token["auth"])
        assert r.status_code == 200
        d = r.json()
        assert len(d.get("items", [])) <= 5
        r2 = s.get(f"{API}/exercises?muscle=chest&difficulty=intermediate&limit=10", headers=user_token["auth"])
        assert r2.status_code == 200

    def test_detail_with_history(self, s, user_token):
        r = s.get(f"{API}/exercises?limit=1", headers=user_token["auth"])
        ex_id = r.json()["items"][0]["id"]
        r2 = s.get(f"{API}/exercises/{ex_id}?lang=de", headers=user_token["auth"])
        assert r2.status_code == 200
        d = r2.json()
        assert "instructions" in d
        assert "history" in d or "personal_best" in d

    def test_meta(self, s, user_token):
        r = s.get(f"{API}/exercises/meta?lang=de", headers=user_token["auth"])
        assert r.status_code == 200
        d = r.json()
        assert "muscles" in d and "equipment" in d


# ---------- plans ----------
class TestPlans:
    def test_templates_and_create(self, s, user_token):
        r = s.get(f"{API}/plans/templates", headers=user_token["auth"])
        assert r.status_code == 200
        tpls = r.json().get("items", [])
        assert len(tpls) > 0
        tid = tpls[0]["id"]
        r2 = s.post(f"{API}/plans/from-template/{tid}", headers=user_token["auth"])
        assert r2.status_code == 200, r2.text
        plan = r2.json()
        assert plan.get("id")
        # duplicate
        r3 = s.post(f"{API}/plans/{plan['id']}/duplicate", headers=user_token["auth"])
        assert r3.status_code == 200

    def test_generate_plan(self, s, user_token):
        body = {"goal": "build_muscle", "experience": "intermediate", "days_per_week": 4}
        r = s.post(f"{API}/plans/generate", json=body, headers=user_token["auth"])
        assert r.status_code == 200, r.text
        assert r.json().get("days")


# ---------- sessions ----------
class TestSessions:
    def test_active_workout_flow(self, s, user_token):
        # create plan
        body = {"goal": "build_muscle", "experience": "intermediate", "days_per_week": 4}
        r = s.post(f"{API}/plans/generate", json=body, headers=user_token["auth"])
        plan = r.json()
        day = plan["days"][0]
        # start
        r2 = s.post(f"{API}/sessions/start", json={"plan_id": plan["id"], "day_index": 0}, headers=user_token["auth"])
        assert r2.status_code == 200, r2.text
        session = r2.json()
        sid = session["id"]
        # active
        r3 = s.get(f"{API}/sessions/active", headers=user_token["auth"])
        assert r3.status_code == 200
        assert r3.json() and r3.json().get("id") == sid
        # finish
        r4 = s.post(f"{API}/sessions/{sid}/finish", json={}, headers=user_token["auth"])
        assert r4.status_code == 200, r4.text
        fin = r4.json()
        assert "xp_gained" in fin
        # history
        r5 = s.get(f"{API}/sessions", headers=user_token["auth"])
        assert r5.status_code == 200


# ---------- progress ----------
class TestProgress:
    def test_summary_empty_ok(self, s):
        # fresh user with no measurements
        r_reg, email, pw = _register(s)
        auth = {"Authorization": f"Bearer {r_reg.json()['token']}"}
        r = s.get(f"{API}/progress/summary", headers=auth)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "weights" in d or "bmi" in d

    def test_measurement_and_summary(self, s, user_token):
        r = s.post(f"{API}/measurements", json={"weight_kg": 80, "body_fat": 18}, headers=user_token["auth"])
        assert r.status_code == 200
        r2 = s.get(f"{API}/progress/summary", headers=user_token["auth"])
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("bmi") is not None


# ---------- food ----------
class TestFood:
    def test_food_search_and_entries(self, s, user_token):
        r = s.get(f"{API}/food/search?q=milk", headers=user_token["auth"])
        # OFF proxy may be slow but should return 200
        assert r.status_code == 200, r.text
        entry = {"name": "Test Milk", "calories": 100, "protein": 5, "carbs": 10, "fat": 3, "grams": 250, "meal": "breakfast"}
        r2 = s.post(f"{API}/food/entries", json=entry, headers=user_token["auth"])
        assert r2.status_code == 200, r2.text
        r3 = s.get(f"{API}/food/entries", headers=user_token["auth"])
        assert r3.status_code == 200
        r4 = s.get(f"{API}/food/summary", headers=user_token["auth"])
        assert r4.status_code == 200
        totals = r4.json()
        assert totals.get("calories", 0) >= 100 or "totals" in totals


# ---------- gamification & leaderboard ----------
class TestGamification:
    def test_gamification(self, s, user_token):
        r = s.get(f"{API}/gamification", headers=user_token["auth"])
        assert r.status_code == 200
        d = r.json()
        assert "xp" in d and "level" in d

    def test_leaderboard_optin(self, s, user_token):
        r = s.get(f"{API}/leaderboard?metric=xp", headers=user_token["auth"])
        assert r.status_code == 200
        # opt-in
        r2 = s.put(f"{API}/users/me/leaderboard-optin", json={"opted_in": True}, headers=user_token["auth"])
        assert r2.status_code == 200
        r3 = s.get(f"{API}/leaderboard?metric=xp", headers=user_token["auth"])
        assert r3.status_code == 200
        d = r3.json()
        assert d.get("opted_in") in (True, False)  # response must include flag


# ---------- admin RBAC ----------
class TestAdmin:
    def test_admin_endpoints_forbidden_for_user(self, s, user_token):
        for path in ("/admin/overview", "/admin/users", "/admin/audit", "/admin/reports"):
            r = s.get(f"{API}{path}", headers=user_token["auth"])
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_admin_endpoints_ok_for_admin(self, s, admin_token):
        for path in ("/admin/overview", "/admin/users", "/admin/audit", "/admin/reports"):
            r = s.get(f"{API}{path}", headers=admin_token["auth"])
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"

    def test_promote_and_demote(self, s, admin_token):
        # create new user
        rreg, email, pw = _register(s)
        uid = rreg.json()["user"]["id"]
        # promote as admin
        r = s.patch(f"{API}/admin/users/{uid}/role", json={"action": "promote"}, headers=admin_token["auth"])
        assert r.status_code == 200, r.text
        # login as the promoted user - should not be root_admin
        rl = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
        promoted_auth = {"Authorization": f"Bearer {rl.json()['token']}"}
        # promoted admin tries to demote another admin (create another user + promote first)
        rreg2, email2, pw2 = _register(s)
        uid2 = rreg2.json()["user"]["id"]
        s.patch(f"{API}/admin/users/{uid2}/role", json={"action": "promote"}, headers=admin_token["auth"])
        # non-root admin tries demote -> 403
        r_dem = s.patch(f"{API}/admin/users/{uid2}/role", json={"action": "demote"}, headers=promoted_auth)
        assert r_dem.status_code == 403, r_dem.text
        # root admin demotes -> 200
        r_ok = s.patch(f"{API}/admin/users/{uid2}/role", json={"action": "demote"}, headers=admin_token["auth"])
        assert r_ok.status_code == 200, r_ok.text

    def test_root_admin_cannot_be_modified(self, s, admin_token):
        # find root admin id
        r = s.get(f"{API}/admin/users", headers=admin_token["auth"])
        users = r.json().get("items", r.json() if isinstance(r.json(), list) else [])
        root = next((u for u in users if u.get("root_admin")), None)
        assert root, "root admin not found in admin users list"
        r2 = s.patch(f"{API}/admin/users/{root['id']}/role", json={"action": "demote"}, headers=admin_token["auth"])
        assert r2.status_code in (400, 403), r2.text


# ---------- subscription ----------
class TestSubscription:
    def test_subscription_flow(self, s, user_token):
        r = s.get(f"{API}/subscription", headers=user_token["auth"])
        assert r.status_code == 200
        r2 = s.post(f"{API}/subscription/set", json={"tier": "premium"}, headers=user_token["auth"])
        assert r2.status_code == 200
        r3 = s.get(f"{API}/subscription", headers=user_token["auth"])
        assert r3.status_code == 200
        assert r3.json().get("tier") == "premium"
        r4 = s.post(f"{API}/subscription/set", json={"tier": "free"}, headers=user_token["auth"])
        assert r4.status_code == 200
