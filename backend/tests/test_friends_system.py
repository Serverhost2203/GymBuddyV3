"""
Iteration 5 — Friend system, post/profile visibility, notifications, search, regressions.
Run:
  pytest /app/backend/tests/test_friends_system.py -v -n 0 \
      --junitxml=/app/test_reports/pytest/pytest_iteration5.xml

Uses public preview URL from /app/frontend/.env (EXPO_PUBLIC_BACKEND_URL) + /api.
Registers ephemeral users A/B/C prefixed test_<uuid>@example.com and DELETE /users/me
teardown to purge. Login rate_limit is per-email (10/60s), we NEVER re-login the
same email inside a class — we just cache token from /auth/register.
"""

import os
import uuid
import time
import pytest
import requests
from pathlib import Path

# Load EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env (no defaults – fail fast)
_env = Path("/app/frontend/.env").read_text()
_pub = next((l.split("=", 1)[1].strip().strip('"') for l in _env.splitlines()
             if l.startswith("EXPO_PUBLIC_BACKEND_URL=")), None)
assert _pub, "EXPO_PUBLIC_BACKEND_URL missing from /app/frontend/.env"
BASE = _pub.rstrip("/") + "/api"


# ---------------------------------------------------------------- helpers
def _mk_email(tag: str) -> str:
    return f"test_{tag}_{uuid.uuid4().hex[:10]}@example.com"


def _register(name: str) -> dict:
    email = _mk_email(name.lower())
    r = requests.post(f"{BASE}/auth/register",
                      json={"name": name, "email": email, "password": "Passw0rd1"},
                      timeout=15)
    assert r.status_code == 200, f"register {name}: {r.status_code} {r.text}"
    data = r.json()
    return {"id": data["user"]["id"], "email": email, "token": data["token"],
            "headers": {"Authorization": f"Bearer {data['token']}",
                        "Content-Type": "application/json"}}


def _cleanup(users: list):
    for u in users:
        try:
            requests.delete(f"{BASE}/users/me", headers=u["headers"], timeout=10)
        except Exception:
            pass


# ---------------------------------------------------------------- FRIEND REQUESTS
class TestFriendRequests:
    @classmethod
    def setup_class(cls):
        cls.A = _register("Alice")
        cls.B = _register("Bob")
        cls.C = _register("Carol")

    @classmethod
    def teardown_class(cls):
        _cleanup([cls.A, cls.B, cls.C])

    def test_01_A_requests_B_returns_outgoing(self):
        r = requests.post(f"{BASE}/friends/request",
                          headers=self.A["headers"],
                          json={"user_id": self.B["id"]})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "outgoing"
        assert "request_id" in j and j["request_id"]
        type(self).REQ_AB = j["request_id"]

    def test_02_B_lists_incoming_request_from_A(self):
        r = requests.get(f"{BASE}/friends/requests", headers=self.B["headers"])
        assert r.status_code == 200
        items = r.json()["items"]
        ids = [it["user"]["id"] for it in items]
        assert self.A["id"] in ids
        rids = [it["request_id"] for it in items]
        assert self.REQ_AB in rids

    def test_03_B_sees_friend_request_notification_and_unread(self):
        r = requests.get(f"{BASE}/notifications", headers=self.B["headers"])
        assert r.status_code == 200
        notifs = r.json()["items"]
        fr = [n for n in notifs if n["type"] == "friend_request"
              and n["actor"]["id"] == self.A["id"]]
        assert fr, f"no friend_request notif from A: {notifs}"
        assert fr[0].get("request_id") == self.REQ_AB
        assert fr[0]["read"] is False

        r2 = requests.get(f"{BASE}/notifications/unread_count",
                          headers=self.B["headers"])
        assert r2.status_code == 200
        assert r2.json()["count"] >= 1

    def test_04_B_accepts_request_becomes_friends(self):
        r = requests.post(f"{BASE}/friends/{self.REQ_AB}/accept",
                          headers=self.B["headers"], json={})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "friends"

        # A sees B in friends list
        rA = requests.get(f"{BASE}/friends", headers=self.A["headers"])
        assert rA.status_code == 200
        assert self.B["id"] in [f["id"] for f in rA.json()["items"]]

        # A gets friend_accept notification
        rN = requests.get(f"{BASE}/notifications", headers=self.A["headers"])
        assert rN.status_code == 200
        acc = [n for n in rN.json()["items"] if n["type"] == "friend_accept"
               and n["actor"]["id"] == self.B["id"]]
        assert acc, "A did not get friend_accept notif"

    def test_05_accept_marked_originating_notification_read(self):
        # B's friend_request notification (about the accepted req) is now read
        r = requests.get(f"{BASE}/notifications", headers=self.B["headers"])
        target = next((n for n in r.json()["items"]
                       if n["type"] == "friend_request"
                       and n.get("request_id") == self.REQ_AB), None)
        assert target is not None
        assert target["read"] is True, "originating notif should be read after accept"

    def test_06_decline_path_A_requests_C_C_declines(self):
        r = requests.post(f"{BASE}/friends/request",
                          headers=self.A["headers"],
                          json={"user_id": self.C["id"]})
        assert r.status_code == 200
        rid = r.json()["request_id"]

        # C declines
        rd = requests.post(f"{BASE}/friends/{rid}/decline",
                           headers=self.C["headers"], json={})
        assert rd.status_code == 200, rd.text

        # request no longer listed
        rl = requests.get(f"{BASE}/friends/requests", headers=self.C["headers"])
        assert rid not in [it["request_id"] for it in rl.json()["items"]]

        # not friends
        fs = requests.get(f"{BASE}/friends/status/{self.C['id']}",
                          headers=self.A["headers"]).json()
        assert fs["status"] == "none"

        # A's friends list still only has B (not C)
        rf = requests.get(f"{BASE}/friends", headers=self.A["headers"]).json()
        assert self.C["id"] not in [f["id"] for f in rf["items"]]

    def test_07_reverse_auto_accept(self):
        # Unfriend A-B first to reset
        ur = requests.delete(f"{BASE}/friends/{self.B['id']}",
                             headers=self.A["headers"])
        assert ur.status_code == 200
        # Confirm not friends
        assert requests.get(f"{BASE}/friends/status/{self.B['id']}",
                            headers=self.A["headers"]).json()["status"] == "none"

        # A -> B
        r1 = requests.post(f"{BASE}/friends/request",
                          headers=self.A["headers"],
                          json={"user_id": self.B["id"]})
        assert r1.status_code == 200
        assert r1.json()["status"] == "outgoing"

        # B -> A should auto-accept to friends
        r2 = requests.post(f"{BASE}/friends/request",
                          headers=self.B["headers"],
                          json={"user_id": self.A["id"]})
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "friends"

        # verify DB via /friends
        assert self.B["id"] in [f["id"] for f in requests.get(
            f"{BASE}/friends", headers=self.A["headers"]).json()["items"]]

    def test_08_delete_friend_unfriends(self):
        r = requests.delete(f"{BASE}/friends/{self.B['id']}",
                            headers=self.A["headers"])
        assert r.status_code == 200
        # not in friends anymore
        assert self.B["id"] not in [f["id"] for f in requests.get(
            f"{BASE}/friends", headers=self.A["headers"]).json()["items"]]
        # status is none
        assert requests.get(f"{BASE}/friends/status/{self.B['id']}",
                            headers=self.A["headers"]).json()["status"] == "none"

    def test_09_cannot_request_self(self):
        r = requests.post(f"{BASE}/friends/request",
                          headers=self.A["headers"],
                          json={"user_id": self.A["id"]})
        assert r.status_code == 400

    def test_10_mark_all_notifications_read(self):
        # A currently has friend_accept notifs (unread)
        pre = requests.get(f"{BASE}/notifications/unread_count",
                           headers=self.A["headers"]).json()["count"]
        assert pre >= 0
        rr = requests.post(f"{BASE}/notifications/read",
                          headers=self.A["headers"], json={})
        assert rr.status_code == 200
        post = requests.get(f"{BASE}/notifications/unread_count",
                            headers=self.A["headers"]).json()["count"]
        assert post == 0


# ---------------------------------------------------------------- POST VISIBILITY
class TestPostVisibility:
    @classmethod
    def setup_class(cls):
        cls.A = _register("Anna")
        cls.B = _register("Bill")
        cls.C = _register("Cody")
        # A public profile so /feed public flow works
        requests.put(f"{BASE}/users/me", headers=cls.A["headers"],
                     json={"privacy": {"profile_visibility": "public"}})
        # Make A & B friends via A->B, B accepts
        r = requests.post(f"{BASE}/friends/request", headers=cls.A["headers"],
                          json={"user_id": cls.B["id"]}).json()
        requests.post(f"{BASE}/friends/{r['request_id']}/accept",
                      headers=cls.B["headers"], json={})
        # A creates 3 posts
        def _post(vis):
            rr = requests.post(f"{BASE}/posts", headers=cls.A["headers"],
                               json={"text": f"hello-{vis}", "visibility": vis})
            assert rr.status_code == 200, rr.text
            return rr.json()["id"]
        cls.PUB = _post("public")
        cls.FRI = _post("friends")
        cls.PRI = _post("private")

    @classmethod
    def teardown_class(cls):
        _cleanup([cls.A, cls.B, cls.C])

    def test_public_readable_by_everyone(self):
        for u in (self.A, self.B, self.C):
            r = requests.get(f"{BASE}/posts/{self.PUB}", headers=u["headers"])
            assert r.status_code == 200, f"{u['email']}: {r.status_code}"
            assert r.json()["visibility"] == "public"

    def test_friends_post_readable_by_friend_only(self):
        # B is friend -> 200
        rB = requests.get(f"{BASE}/posts/{self.FRI}", headers=self.B["headers"])
        assert rB.status_code == 200
        # C not friend -> 403
        rC = requests.get(f"{BASE}/posts/{self.FRI}", headers=self.C["headers"])
        assert rC.status_code == 403
        # author -> 200
        rA = requests.get(f"{BASE}/posts/{self.FRI}", headers=self.A["headers"])
        assert rA.status_code == 200

    def test_private_post_only_author(self):
        rB = requests.get(f"{BASE}/posts/{self.PRI}", headers=self.B["headers"])
        assert rB.status_code == 403
        rC = requests.get(f"{BASE}/posts/{self.PRI}", headers=self.C["headers"])
        assert rC.status_code == 403
        rA = requests.get(f"{BASE}/posts/{self.PRI}", headers=self.A["headers"])
        assert rA.status_code == 200

    def test_feed_friends_scope_for_B_has_public_and_friends_not_private(self):
        r = requests.get(f"{BASE}/feed", headers=self.B["headers"],
                         params={"scope": "friends"})
        assert r.status_code == 200
        pids = [p["id"] for p in r.json()["items"]]
        assert self.PUB in pids
        assert self.FRI in pids
        assert self.PRI not in pids

    def test_feed_public_scope_only_public_posts_from_public_profiles(self):
        r = requests.get(f"{BASE}/feed", headers=self.C["headers"],
                         params={"scope": "public"})
        assert r.status_code == 200
        items = r.json()["items"]
        pids = [p["id"] for p in items]
        assert self.PUB in pids
        assert self.FRI not in pids
        assert self.PRI not in pids
        # all posts must have visibility public
        for p in items:
            assert p["visibility"] == "public"


# ---------------------------------------------------------------- PROFILE VISIBILITY
class TestProfileVisibility:
    @classmethod
    def setup_class(cls):
        cls.A = _register("Aiden")
        cls.B = _register("Beth")
        cls.C = _register("Cass")
        # A & B friends
        r = requests.post(f"{BASE}/friends/request", headers=cls.A["headers"],
                          json={"user_id": cls.B["id"]}).json()
        requests.post(f"{BASE}/friends/{r['request_id']}/accept",
                      headers=cls.B["headers"], json={})

    @classmethod
    def teardown_class(cls):
        _cleanup([cls.A, cls.B, cls.C])

    def _set_vis(self, v):
        r = requests.put(f"{BASE}/users/me", headers=self.A["headers"],
                         json={"privacy": {"profile_visibility": v}})
        assert r.status_code == 200, r.text
        priv = r.json()["privacy"]
        assert priv["profile_visibility"] == v
        # sync check
        assert priv["profile_public"] == (v == "public")
        return r.json()

    def test_friends_visibility(self):
        self._set_vis("friends")
        # B (friend) sees profile
        rB = requests.get(f"{BASE}/users/{self.A['id']}/profile",
                          headers=self.B["headers"])
        assert rB.status_code == 200
        assert rB.json()["is_friend"] is True
        # C (non-friend) blocked
        rC = requests.get(f"{BASE}/users/{self.A['id']}/profile",
                          headers=self.C["headers"])
        assert rC.status_code == 403

    def test_private_visibility(self):
        self._set_vis("private")
        for u in (self.B, self.C):
            r = requests.get(f"{BASE}/users/{self.A['id']}/profile",
                             headers=u["headers"])
            assert r.status_code == 403

    def test_public_visibility_all_200_and_in_public_feed(self):
        self._set_vis("public")
        # A creates one public post so feed has something
        pid = requests.post(f"{BASE}/posts", headers=self.A["headers"],
                            json={"text": "hi world", "visibility": "public"}).json()["id"]
        for u in (self.B, self.C):
            r = requests.get(f"{BASE}/users/{self.A['id']}/profile",
                             headers=u["headers"])
            assert r.status_code == 200
        # A appears in scope=public feed (via post)
        fr = requests.get(f"{BASE}/feed", headers=self.C["headers"],
                          params={"scope": "public"}).json()
        assert pid in [p["id"] for p in fr["items"]]

        # Now flip back to private → post should DISAPPEAR from public feed
        self._set_vis("private")
        fr2 = requests.get(f"{BASE}/feed", headers=self.C["headers"],
                           params={"scope": "public"}).json()
        assert pid not in [p["id"] for p in fr2["items"]]


# ---------------------------------------------------------------- USER SEARCH
class TestUserSearch:
    @classmethod
    def setup_class(cls):
        cls.tag = uuid.uuid4().hex[:8]
        # Unique searchable name substring
        cls.A = _register(f"Zorak{cls.tag}A")
        cls.B = _register(f"Zorak{cls.tag}B")
        cls.C = _register(f"Zorak{cls.tag}C")
        # Make B non-public (private profile) — still must appear in search
        requests.put(f"{BASE}/users/me", headers=cls.B["headers"],
                     json={"privacy": {"profile_visibility": "private"}})
        # A friends C
        r = requests.post(f"{BASE}/friends/request", headers=cls.A["headers"],
                          json={"user_id": cls.C["id"]}).json()
        requests.post(f"{BASE}/friends/{r['request_id']}/accept",
                      headers=cls.C["headers"], json={})

    @classmethod
    def teardown_class(cls):
        _cleanup([cls.A, cls.B, cls.C])

    def test_search_includes_private_profiles_excludes_self_returns_flags(self):
        r = requests.get(f"{BASE}/users/search", headers=self.A["headers"],
                         params={"q": f"Zorak{self.tag}"})
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {u["id"]: u for u in items}
        assert self.A["id"] not in ids, "self must be excluded"
        assert self.B["id"] in ids, "private-profile user must be findable"
        assert self.C["id"] in ids
        # C is a friend
        assert ids[self.C["id"]]["is_friend"] is True
        assert ids[self.B["id"]]["is_friend"] is False
        # visibility field present
        assert ids[self.B["id"]]["visibility"] == "private"


# ---------------------------------------------------------------- ACCEPT/DECLINE NOTIF read
class TestNotificationReadOnAction:
    @classmethod
    def setup_class(cls):
        cls.A = _register("Nick")
        cls.B = _register("Nora")

    @classmethod
    def teardown_class(cls):
        _cleanup([cls.A, cls.B])

    def test_decline_marks_originating_notif_read(self):
        rid = requests.post(f"{BASE}/friends/request", headers=self.A["headers"],
                            json={"user_id": self.B["id"]}).json()["request_id"]
        # confirm unread
        pre = [n for n in requests.get(f"{BASE}/notifications",
               headers=self.B["headers"]).json()["items"]
               if n.get("request_id") == rid]
        assert pre and pre[0]["read"] is False
        # decline
        assert requests.post(f"{BASE}/friends/{rid}/decline",
                             headers=self.B["headers"], json={}).status_code == 200
        # notif now read
        post = [n for n in requests.get(f"{BASE}/notifications",
                headers=self.B["headers"]).json()["items"]
                if n.get("request_id") == rid]
        assert post and post[0]["read"] is True


# ---------------------------------------------------------------- HARD DELETE PURGE
class TestHardDeletePurge:
    def test_delete_self_purges_friends_and_notifs(self):
        A = _register("Purga")
        B = _register("Purgb")
        try:
            # create friendship + notifs both ways
            rid = requests.post(f"{BASE}/friends/request", headers=A["headers"],
                                json={"user_id": B["id"]}).json()["request_id"]
            requests.post(f"{BASE}/friends/{rid}/accept", headers=B["headers"], json={})
            # B has unread accept-notif deletion should cascade
            assert requests.get(f"{BASE}/friends", headers=A["headers"]
                                ).json()["items"], "precondition: friends"
            # A hard-deletes self
            d = requests.delete(f"{BASE}/users/me", headers=A["headers"])
            assert d.status_code == 200
            # B's friend list no longer contains A
            fb = requests.get(f"{BASE}/friends", headers=B["headers"]).json()
            assert A["id"] not in [f["id"] for f in fb["items"]]
            # B's notifications no longer contain any actor=A
            nb = requests.get(f"{BASE}/notifications", headers=B["headers"]).json()
            assert not any(n["actor"]["id"] == A["id"] for n in nb["items"])
        finally:
            _cleanup([B])  # A is already dead


# ---------------------------------------------------------------- REGRESSION: explore/comments
class TestRegression:
    @classmethod
    def setup_class(cls):
        cls.A = _register("Rega")

    @classmethod
    def teardown_class(cls):
        _cleanup([cls.A])

    def test_explore_endpoint_still_works(self):
        r = requests.get(f"{BASE}/feed/explore", headers=self.A["headers"])
        # Endpoint might be under /explore instead — try both
        if r.status_code == 404:
            r = requests.get(f"{BASE}/explore", headers=self.A["headers"])
        assert r.status_code == 200, f"explore endpoint failed: {r.status_code}"

    def test_comment_moderation_still_works(self):
        requests.put(f"{BASE}/users/me", headers=self.A["headers"],
                     json={"privacy": {"profile_visibility": "public"}})
        pid = requests.post(f"{BASE}/posts", headers=self.A["headers"],
                            json={"text": "reg", "visibility": "public"}).json()["id"]
        c = requests.post(f"{BASE}/posts/{pid}/comments",
                          headers=self.A["headers"],
                          json={"text": "hello comment"})
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        # edit
        e = requests.put(f"{BASE}/posts/{pid}/comments/{cid}",
                        headers=self.A["headers"],
                        json={"text": "edited"})
        assert e.status_code == 200
        # delete
        d = requests.delete(f"{BASE}/posts/{pid}/comments/{cid}",
                            headers=self.A["headers"])
        assert d.status_code == 200
