"""
Iteration 4 — Security-fix regression tests.
Covers:
  SEC-001  No source-default admin creds (old default password now fails; rotated one succeeds)
  SEC-002  Promote is ROOT-only (was any-admin); Demote remains ROOT-only
  SEC-003  Token invalidation on password change (pw_changed_at)
  Enumeration fix on /auth/forgot-password (root email -> 200, not 403)
  Regressions: admin_overview both admins, root-only delete/edit-user, self hard-delete,
               reset-password happy path returns working token,
               normal user mass-assignment blocked (role/root_admin cannot be self-set).
"""
import os
import time
import uuid
import bcrypt
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# ---- Config ----------------------------------------------------------------
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    # fallback for local runs
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
API = BASE_URL.rstrip("/") + "/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
mongo = MongoClient(MONGO_URL)[DB_NAME]

ROOT_EMAIL = "myscraptv@gmail.com"
ROOT_PW    = "RootPass123"
REG_ADMIN_EMAIL = "admin@gymbuddy.app"
REG_ADMIN_PW    = "GbpILMEvPcKRGzK9ZG!7"
OLD_ADMIN_PW    = "AdminGym2026!"          # rotated / removed
RESEND_TEST     = "delivered@resend.dev"


def _login(email, password, retries=4):
    """Login with retry on 429 (in-memory rate_limit is per-email 10/min)."""
    for i in range(retries):
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
        if r.status_code != 429:
            return r
        # back off
        time.sleep(3 + 2 * i)
    return r


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


_ROOT_TOKEN = {"tok": None}


def _fresh_root_token(force=False):
    """
    Cache root token to avoid hitting per-email login rate_limit (10/min).
    Only force-refresh when caller explicitly changed root's password.
    """
    if _ROOT_TOKEN["tok"] and not force:
        return _ROOT_TOKEN["tok"]
    r = _login(ROOT_EMAIL, ROOT_PW)
    assert r.status_code == 200, f"root re-login failed: {r.status_code} {r.text}"
    _ROOT_TOKEN["tok"] = r.json()["token"]
    return _ROOT_TOKEN["tok"]


def _reg_admin_token():
    r = _login(REG_ADMIN_EMAIL, REG_ADMIN_PW)
    assert r.status_code == 200, f"regular admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _register(name_prefix="sec4"):
    # keep local part all-lowercase so DB storage (lowercased by server) matches test queries
    email = f"test_{name_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    pw = "InitPass123"
    r = requests.post(f"{API}/auth/register",
                      json={"name": f"{name_prefix} user", "email": email, "password": pw},
                      timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return body["token"], body["user"], email, pw


# ---- SEC-001 — no source-default creds -------------------------------------
class TestSEC001NoSourceDefaultCreds:
    def test_health_ok(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_old_default_password_now_rejected(self):
        r = _login(REG_ADMIN_EMAIL, OLD_ADMIN_PW)
        assert r.status_code == 401, f"OLD default password must now fail, got {r.status_code} {r.text}"

    def test_rotated_password_succeeds(self):
        r = _login(REG_ADMIN_EMAIL, REG_ADMIN_PW)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"
        assert r.json()["user"].get("root_admin") in (False, None)


# ---- SEC-002 — promote/demote root-only ------------------------------------
class TestSEC002RootOnlyRoleChange:
    def _make_victim(self):
        _, u, _, _ = _register("victim")
        return u["id"]

    def test_regular_admin_promote_forbidden(self):
        vid = self._make_victim()
        try:
            tok = _reg_admin_token()
            r = requests.patch(f"{API}/admin/users/{vid}/role",
                               json={"action": "promote"}, headers=_hdr(tok), timeout=15)
            assert r.status_code == 403, f"regular admin promote must be 403, got {r.status_code} {r.text}"
            # confirm still a user
            db_user = mongo.users.find_one({"id": vid})
            assert db_user["role"] == "user"
        finally:
            # cleanup
            rtok = _fresh_root_token()
            requests.delete(f"{API}/admin/users/{vid}", headers=_hdr(rtok), timeout=15)

    def test_regular_admin_demote_forbidden(self):
        # first promote via root
        vid = self._make_victim()
        try:
            rtok = _fresh_root_token()
            up = requests.patch(f"{API}/admin/users/{vid}/role",
                                json={"action": "promote"}, headers=_hdr(rtok), timeout=15)
            assert up.status_code == 200
            # now try demote as regular admin
            atok = _reg_admin_token()
            r = requests.patch(f"{API}/admin/users/{vid}/role",
                               json={"action": "demote"}, headers=_hdr(atok), timeout=15)
            assert r.status_code == 403, f"regular admin demote must be 403, got {r.status_code} {r.text}"
            # confirm still admin
            db_user = mongo.users.find_one({"id": vid})
            assert db_user["role"] == "admin"
        finally:
            rtok = _fresh_root_token()
            requests.delete(f"{API}/admin/users/{vid}", headers=_hdr(rtok), timeout=15)

    def test_root_promote_and_demote_ok(self):
        vid = self._make_victim()
        try:
            rtok = _fresh_root_token()
            r1 = requests.patch(f"{API}/admin/users/{vid}/role",
                                json={"action": "promote"}, headers=_hdr(rtok), timeout=15)
            assert r1.status_code == 200
            assert mongo.users.find_one({"id": vid})["role"] == "admin"
            r2 = requests.patch(f"{API}/admin/users/{vid}/role",
                                json={"action": "demote"}, headers=_hdr(rtok), timeout=15)
            assert r2.status_code == 200
            assert mongo.users.find_one({"id": vid})["role"] == "user"
        finally:
            rtok = _fresh_root_token()
            requests.delete(f"{API}/admin/users/{vid}", headers=_hdr(rtok), timeout=15)


# ---- SEC-003 — token invalidation on password change -----------------------
class TestSEC003TokenInvalidation:
    def test_admin_set_password_invalidates_old_token(self):
        token_a, user, _, _ = _register("tokinval")
        uid = user["id"]
        # sanity: token_a works
        r = requests.get(f"{API}/auth/me", headers=_hdr(token_a), timeout=15)
        assert r.status_code == 200
        # Root sets a new password
        rtok = _fresh_root_token()
        new_pw = "BrandNewPw" + uuid.uuid4().hex[:4]
        sp = requests.post(f"{API}/admin/users/{uid}/password",
                           json={"password": new_pw}, headers=_hdr(rtok), timeout=15)
        assert sp.status_code == 200
        # token_a MUST be rejected now
        # tiny sleep to guarantee wall clock has ticked past pw_changed_at second boundary is not needed,
        # because iat was captured before pw_changed_at.
        r2 = requests.get(f"{API}/auth/me", headers=_hdr(token_a), timeout=15)
        assert r2.status_code == 401, f"token A must be 401 after admin pw change, got {r2.status_code} {r2.text}"
        # cleanup
        rtok = _fresh_root_token()
        requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(rtok), timeout=15)

    def test_reset_password_returns_working_token(self):
        # fresh user
        token_a, user, email, _ = _register("resetok")
        uid = user["id"]
        # trigger forgot-password to create a record (email will fail send / that's fine)
        f = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
        assert f.status_code == 200 and f.json() == {"ok": True}
        # Overwrite the code_hash with a known code
        known_code = "424242"
        code_hash = bcrypt.hashpw(known_code.encode(), bcrypt.gensalt()).decode()
        upd = mongo.password_resets.update_one({"email": email}, {"$set": {"code_hash": code_hash, "attempts": 0}})
        assert upd.matched_count == 1
        # reset with the known code + a new password
        new_pw = "ResetPass" + uuid.uuid4().hex[:4]
        rr = requests.post(f"{API}/auth/reset-password",
                           json={"email": email, "code": known_code, "password": new_pw}, timeout=15)
        assert rr.status_code == 200, f"reset-password failed: {rr.status_code} {rr.text}"
        payload = rr.json()
        assert "token" in payload and "user" in payload
        new_token = payload["token"]
        # NEW token must work on /auth/me (fresh token not wrongly invalidated by its own pw change)
        m = requests.get(f"{API}/auth/me", headers=_hdr(new_token), timeout=15)
        assert m.status_code == 200, f"new reset token rejected: {m.status_code} {m.text}"
        assert m.json()["email"] == email
        # OLD token A must be rejected now (pw_changed_at bumped)
        r_old = requests.get(f"{API}/auth/me", headers=_hdr(token_a), timeout=15)
        assert r_old.status_code == 401, f"old token must be 401 after reset, got {r_old.status_code}"
        # login with new pw also works
        li = _login(email, new_pw)
        assert li.status_code == 200
        # cleanup
        rtok = _fresh_root_token()
        requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(rtok), timeout=15)


# ---- Enumeration fix -------------------------------------------------------
class TestForgotPasswordEnumeration:
    def test_root_email_returns_ok_not_403(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ROOT_EMAIL}, timeout=15)
        assert r.status_code == 200, f"root email must be 200, got {r.status_code} {r.text}"
        assert r.json() == {"ok": True}
        # no reset record was created for root
        rec = mongo.password_resets.find_one({"email": ROOT_EMAIL})
        assert rec is None, "no reset record should be created for the root email"

    def test_unknown_email_returns_ok(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_existing_user_returns_ok_and_creates_record(self):
        # register a temp user then call forgot-password
        _, user, email, _ = _register("enum")
        uid = user["id"]
        try:
            r = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
            assert r.status_code == 200
            assert r.json() == {"ok": True}
            rec = mongo.password_resets.find_one({"email": email})
            assert rec is not None
            assert "code_hash" in rec and rec.get("attempts", 0) == 0
        finally:
            rtok = _fresh_root_token()
            requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(rtok), timeout=15)
            mongo.password_resets.delete_one({"email": email})


# ---- Regression — core admin/user flows still work -------------------------
class TestRegressionCoreAdmin:
    def test_admin_overview_works_for_both(self):
        for tok in (_fresh_root_token(), _reg_admin_token()):
            r = requests.get(f"{API}/admin/overview", headers=_hdr(tok), timeout=15)
            assert r.status_code == 200, f"/admin/overview failed for token: {r.status_code} {r.text}"
            body = r.json()
            # must have some counts
            assert isinstance(body, dict) and len(body) > 0

    def test_delete_user_root_only(self):
        _, user, _, _ = _register("delroot")
        uid = user["id"]
        # regular admin -> 403
        atok = _reg_admin_token()
        r1 = requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(atok), timeout=15)
        assert r1.status_code == 403
        # root -> 200 and purged
        rtok = _fresh_root_token()
        r2 = requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(rtok), timeout=15)
        assert r2.status_code == 200
        assert mongo.users.find_one({"id": uid}) is None

    def test_edit_user_root_only(self):
        _, user, _, _ = _register("editroot")
        uid = user["id"]
        try:
            atok = _reg_admin_token()
            r1 = requests.put(f"{API}/admin/users/{uid}",
                              json={"name": "hacked"}, headers=_hdr(atok), timeout=15)
            assert r1.status_code == 403
            # root ok
            rtok = _fresh_root_token()
            r2 = requests.put(f"{API}/admin/users/{uid}",
                              json={"name": "ByRoot"}, headers=_hdr(rtok), timeout=15)
            assert r2.status_code == 200
            assert r2.json()["name"] == "ByRoot"
        finally:
            rtok = _fresh_root_token()
            requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(rtok), timeout=15)

    def test_self_hard_delete_purges(self):
        tok, user, email, pw = _register("selfdel")
        uid = user["id"]
        # add some data
        requests.post(f"{API}/measurements",
                      json={"weight_kg": 80}, headers=_hdr(tok), timeout=15)
        r = requests.delete(f"{API}/users/me", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        assert mongo.users.find_one({"id": uid}) is None
        assert mongo.measurements.count_documents({"user_id": uid}) == 0


# ---- Regression — normal user mass-assignment blocked ----------------------
class TestRegressionMassAssignment:
    def test_user_cannot_self_escalate(self):
        tok, user, _, _ = _register("massassign")
        uid = user["id"]
        try:
            payload = {"name": "escalate me",
                       "role": "admin",
                       "root_admin": True}
            r = requests.put(f"{API}/users/me", json=payload, headers=_hdr(tok), timeout=15)
            # Pydantic ignores unknown fields by default -> 200 with only name applied
            assert r.status_code == 200, f"{r.status_code} {r.text}"
            body = r.json()
            assert body["name"] == "escalate me"
            assert body.get("role", "user") != "admin"
            assert body.get("root_admin") in (False, None)
            # double-check in DB
            db_u = mongo.users.find_one({"id": uid})
            assert db_u["role"] != "admin"
            assert not db_u.get("root_admin")
        finally:
            rtok = _fresh_root_token()
            requests.delete(f"{API}/admin/users/{uid}", headers=_hdr(rtok), timeout=15)
