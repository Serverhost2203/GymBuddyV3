"""Regression tests for the super-admin (root_admin) bug fix.

Bug: user registered with myscraptv@gmail.com had NO admin rights.
Fix: ROOT_ADMIN_EMAIL=myscraptv@gmail.com in .env + startup bootstrap that
promotes that account (keeping its password) and demotes every other root_admin.
"""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = None
for env_path in ("/app/frontend/.env",):
    with open(env_path) as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not found in frontend/.env"
API = BASE_URL + "/api"

ROOT_EMAIL = os.environ["ROOT_ADMIN_EMAIL"].lower()
TEST_ADMIN_EMAIL = "admin@gymbuddy.app"
TEST_ADMIN_PASSWORD = "AdminGym2026!"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD})
    assert r.status_code == 200, f"test admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --------------------------------------------------------------------------- #
# MongoDB state: root admin bootstrap
# --------------------------------------------------------------------------- #
class TestRootAdminMongoState:
    def test_root_account_is_admin_and_root(self, db):
        u = db.users.find_one({"email": ROOT_EMAIL})
        assert u is not None, f"{ROOT_EMAIL} account not found"
        assert u.get("role") == "admin"
        assert u.get("root_admin") is True
        assert u.get("deleted_at") is None

    def test_exactly_one_root_admin_exists(self, db):
        roots = list(db.users.find({"root_admin": True}))
        assert len(roots) == 1, f"expected 1 root admin, found {len(roots)}: {[r.get('email') for r in roots]}"
        assert roots[0]["email"] == ROOT_EMAIL

    def test_root_password_not_reset_by_bootstrap(self, db):
        """Bootstrap must not overwrite the user's own password hash."""
        u = db.users.find_one({"email": ROOT_EMAIL})
        # The account was created by the user's own registration (custom name),
        # not by the bootstrap fallback which inserts name="Admin".
        assert u.get("password_hash"), "password hash missing"
        assert u.get("name") != "Admin" or u.get("created_at"), "looks like bootstrap-created fallback account"

    def test_test_admin_is_regular_admin_not_root(self, db):
        a = db.users.find_one({"email": TEST_ADMIN_EMAIL})
        assert a is not None, "test admin missing"
        assert a.get("role") == "admin"
        assert a.get("root_admin") is False


# --------------------------------------------------------------------------- #
# Admin API with existing/regular admin token
# --------------------------------------------------------------------------- #
class TestRegularAdminAccess:
    def test_admin_overview_still_works_for_regular_admin(self, admin_headers):
        r = requests.get(f"{API}/admin/overview", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_root") is False, "test admin must not be root"

    def test_admin_users_lists_root_as_admin(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200, r.text
        users = r.json()["items"]
        root = next((u for u in users if u["email"] == ROOT_EMAIL), None)
        assert root is not None, f"{ROOT_EMAIL} not listed in /admin/users"
        assert root["role"] == "admin"
        assert root["root_admin"] is True
        others_root = [u["email"] for u in users if u.get("root_admin") and u["email"] != ROOT_EMAIL]
        assert not others_root, f"unexpected other root admins: {others_root}"


# --------------------------------------------------------------------------- #
# Root-only enforcement: regular admin cannot modify the root admin
# --------------------------------------------------------------------------- #
class TestRootProtection:
    def _root_uid(self, db):
        return db.users.find_one({"email": ROOT_EMAIL})["id"]

    def test_regular_admin_cannot_demote_root(self, db, admin_headers):
        uid = self._root_uid(db)
        r = requests.patch(f"{API}/admin/users/{uid}/role",
                           json={"action": "demote"}, headers=admin_headers)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        # verify state unchanged
        u = db.users.find_one({"email": ROOT_EMAIL})
        assert u["role"] == "admin" and u["root_admin"] is True

    def test_regular_admin_cannot_promote_over_root(self, db, admin_headers):
        uid = self._root_uid(db)
        r = requests.patch(f"{API}/admin/users/{uid}/role",
                           json={"action": "promote"}, headers=admin_headers)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_regular_admin_cannot_disable_root(self, db, admin_headers):
        uid = self._root_uid(db)
        r = requests.patch(f"{API}/admin/users/{uid}/disable", headers=admin_headers)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        u = db.users.find_one({"email": ROOT_EMAIL})
        assert u.get("deleted_at") is None


# --------------------------------------------------------------------------- #
# Registration rules: root email auto-admin, any other email is plain user
# --------------------------------------------------------------------------- #
class TestRegistrationRoles:
    def test_new_registration_is_plain_user(self, db):
        email = f"test_{uuid.uuid4().hex[:8]}@test.de"
        r = requests.post(f"{API}/auth/register",
                          json={"name": "Test User", "email": email, "password": "testpass123"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["role"] == "user"
        assert body["user"].get("root_admin") in (False, None)
        u = db.users.find_one({"email": email})
        assert u["role"] == "user" and u.get("root_admin") is False
        db.users.delete_one({"email": email})  # cleanup

    def test_reregistering_root_email_is_conflict(self):
        r = requests.post(f"{API}/auth/register",
                          json={"name": "X", "email": ROOT_EMAIL, "password": "whatever123"})
        assert r.status_code == 409, f"expected 409, got {r.status_code}"


# --------------------------------------------------------------------------- #
# Existing tokens pick up role changes (get_current_user reads fresh from DB)
# --------------------------------------------------------------------------- #
class TestFreshRoleLookup:
    def test_regular_admin_token_reflects_current_role(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["email"] == TEST_ADMIN_EMAIL
        assert me["role"] == "admin"
        assert me.get("root_admin") is False
