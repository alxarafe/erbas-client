import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from email.message import Message

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("identities", ROOT / "demo/identities.py")
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)
VALUES = dict(zip(demo.NAMES, ("fixture-admin@example.test", "Fixture_admin_123=\"$",
                               "fixture-user@example.test", "Fixture_user_123")))
TEXT = "".join(name + "=" + value + "\n" for name, value in VALUES.items())


class DefaultsTests(unittest.TestCase):
    def test_literal_values_preserved_without_shell_evaluation(self):
        self.assertEqual(demo.parse_defaults(TEXT), VALUES)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "demo"
            path.mkdir()
            (path / "defaults.env").write_text(TEXT)
            env = {key: value for key, value in os.environ.items() if not key.startswith("ERBAS_DEMO_")}
            env["ERBAS_CONTRACT_DIR"] = directory
            env[demo.NAMES[0]] = "override-admin@example.test"
            script = 'source "$1/bin/demo-common"; set_demo_identity; python3 "$1/demo/identities.py" defaults "$ERBAS_CONTRACT_DIR/demo/defaults.env"'
            result = subprocess.run(["bash", "-eu", "-c", script, "test", str(ROOT)], env=env,
                                    capture_output=True, text=True, check=True)
            effective = demo.parse_defaults(result.stdout)
            self.assertEqual(effective, VALUES | {demo.NAMES[0]: env[demo.NAMES[0]]})

    def test_every_explicit_value_overrides_its_default(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "defaults.env"
            path.write_text(TEXT)
            for name in demo.NAMES:
                with self.subTest(name=name):
                    self.assertEqual(demo.resolve_defaults(path, {name: "Disposable_override_123"}),
                                     VALUES | {name: "Disposable_override_123"})

    def test_missing_duplicate_unknown_empty_and_control_values_fail(self):
        for text in ("", TEXT + TEXT.splitlines()[0], TEXT + "OTHER=x\n",
                     TEXT.replace(VALUES[demo.NAMES[0]], ""), TEXT + "\r", TEXT + "\0",
                     TEXT.replace(VALUES[demo.NAMES[2]], VALUES[demo.NAMES[0]])):
            with self.subTest(text_index=len(text)), self.assertRaises(demo.DemoError):
                demo.parse_defaults(text)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "defaults.env"
            path.write_text(TEXT)
            for value in ("", "bad\rvalue", "bad\nvalue", "bad\0value"):
                with self.assertRaises(demo.DemoError):
                    demo.resolve_defaults(path, {demo.NAMES[1]: value})
            with self.assertRaises(OSError):
                demo.resolve_defaults(path.with_name("missing"), {})


class ProvisionTests(unittest.TestCase):
    def responses(self, create_status=201, user_enabled=True, user_admin=False, login_status=200):
        headers = Message()
        headers["Content-Type"] = "application/json"
        headers["Cache-Control"] = "no-store"
        def reply(url, payload=None, token=None, raw=False):
            if url.endswith("/api/auth/login"):
                status = 200 if payload["email"] == VALUES[demo.NAMES[0]] else login_status
                return status, headers, {"accessToken": "fixture-token"} if status == 200 else {"code": "invalid_credentials"}
            if url.endswith("/api/auth/me"):
                # Calls occur admin login/me followed by user login/me.
                is_admin = self.me_count == 0
                self.me_count += 1
                return 200, headers, {"id": "opaque", "email": VALUES[demo.NAMES[0 if is_admin else 2]],
                                      "enabled": True if is_admin else user_enabled,
                                      "admin": True if is_admin else user_admin}
            if payload is not None:
                self.assertEqual(payload, {"email": VALUES[demo.NAMES[2]], "password": VALUES[demo.NAMES[3]], "admin": False})
                return create_status, headers, ({"code": "email_conflict"} if create_status == 409 else
                    {"id": "opaque", "email": VALUES[demo.NAMES[2]], "enabled": True, "admin": False})
            return 403, headers, {"code": "forbidden"}
        return reply

    def test_fresh_and_conflicting_users_are_verified_without_mutation(self):
        for status in (201, 409):
            self.me_count = 0
            with patch.object(demo, "request", side_effect=self.responses(status)) as request, patch("builtins.print"):
                demo.verify_backend("Fixture", "http://fixture", VALUES, provision=True)
                self.assertEqual(request.call_count, 6)
                self.assertEqual(sum(call.args[0].endswith("/api/users") and len(call.args) > 1
                                     and call.args[1] is not None for call in request.call_args_list), 1)

    def test_modified_existing_user_fails_with_recovery_guidance(self):
        for args in ({"user_enabled": False}, {"user_admin": True}, {"login_status": 401}):
            self.me_count = 0
            with patch.object(demo, "request", side_effect=self.responses(409, **args)):
                with self.assertRaisesRegex(demo.DemoError, "Reset/recreate.*ERBAS_DEMO_"):
                    demo.verify_backend("Fixture", "http://fixture", VALUES, provision=True)

    def test_redirects_and_duplicate_json_are_rejected(self):
        self.assertIsNone(demo.NoRedirect().redirect_request(None, None, None, None, None, None))
        with self.assertRaises(demo.DemoError):
            demo.unique_object([("code", "forbidden"), ("code", "forbidden")])


class UserReadTests(unittest.TestCase):
    def responses(self, fault=None):
        headers = Message()
        headers["Content-Type"] = "application/json"
        headers["Cache-Control"] = "no-store"
        admin = {"id": "opaque /?# user", "email": VALUES[demo.NAMES[0]], "enabled": True, "admin": True}
        regular = {"id": "opaque-regular", "email": VALUES[demo.NAMES[2]], "enabled": True, "admin": False}
        def reply(url, payload=None, token=None):
            if url.endswith("/api/auth/login"):
                return demo.HTTPStatus.OK, headers, {"accessToken": "fixture-admin" if payload["email"] == admin["email"] else "fixture-regular"}
            self.assertIsNone(payload, "Protected user checks must remain read-only")
            if token == demo.INVALID_BEARER:
                challenge = Message(); challenge["Cache-Control"] = "no-store"; challenge["WWW-Authenticate"] = "Bearer"
                return demo.HTTPStatus.UNAUTHORIZED, challenge, {"code": demo.PROTECTED_ERRORS[demo.HTTPStatus.UNAUTHORIZED]}
            if url.endswith(demo.CURRENT_USER_ENDPOINT):
                body = admin if token == "fixture-admin" else regular
                return demo.HTTPStatus.OK, headers, ({**body, "extra": True} if fault == "profile" else body)
            if token == "fixture-regular":
                return demo.HTTPStatus.FORBIDDEN, headers, {"code": demo.PROTECTED_ERRORS[demo.HTTPStatus.FORBIDDEN]}
            if url.endswith(demo.UNKNOWN_USER_ID):
                return demo.HTTPStatus.NOT_FOUND, headers, {"code": demo.PROTECTED_ERRORS[demo.HTTPStatus.NOT_FOUND]}
            if "?offset=" in url:
                body = {"items": [admin], "offset": 0, "limit": demo.USERS_PAGE_SIZE, "total": 1,
                        "order": [{"field": "id", "direction": "asc"}]}
                if fault == "collection": body["order"] = []
                return demo.HTTPStatus.OK, headers, body
            self.assertTrue(url.endswith(demo.quote(admin["id"], safe="")))
            return demo.HTTPStatus.OK, headers, ({**admin, "enabled": "true"} if fault == "detail" else admin)
        return reply

    def test_real_read_verification_is_read_only_and_encodes_opaque_id(self):
        with patch.object(demo, "request", side_effect=self.responses()) as request, patch("builtins.print"):
            demo.verify_reads("Fixture", "http://fixture", VALUES)
        self.assertEqual(request.call_count, 11)

    def test_noncontractual_profile_collection_and_detail_fail_safely(self):
        for fault in ("profile", "collection", "detail"):
            with self.subTest(fault=fault), patch.object(demo, "request", side_effect=self.responses(fault)):
                with self.assertRaises(demo.DemoError):
                    demo.verify_reads("Fixture", "http://fixture", VALUES)


class UserCreateTests(unittest.TestCase):
    def responses(self, fault=None):
        headers = Message()
        headers["Content-Type"] = "application/json"
        headers["Cache-Control"] = "no-store"
        def reply(url, payload=None, token=None):
            if url.endswith("/api/auth/login"):
                return demo.HTTPStatus.OK, headers, {"accessToken": "fixture-admin" if payload["email"] == VALUES[demo.NAMES[0]] else "fixture-regular"}
            self.assertEqual(url, "http://fixture" + demo.USERS_ENDPOINT)
            self.assertEqual(payload, {"email": VALUES[demo.NAMES[2]], "password": VALUES[demo.NAMES[3]], "admin": False})
            status = demo.HTTPStatus.CONFLICT if token == "fixture-admin" else demo.HTTPStatus.FORBIDDEN
            code = demo.PROTECTED_ERRORS[status]
            if fault == "created": status = demo.HTTPStatus.CREATED
            if fault == "extra": return status, headers, {"code": code, "extra": True}
            if fault == "cache": headers.replace_header("Cache-Control", "public")
            if fault == "challenge": headers[demo.USER_CHALLENGE_HEADER] = "Bearer"
            return status, headers, {"code": code}
        return reply

    def test_creation_probe_uses_existing_email_only_and_never_accepts_201(self):
        with patch.object(demo, "request", side_effect=self.responses()) as request, patch("builtins.print"):
            demo.verify_creation("Fixture", "http://fixture", VALUES)
        self.assertEqual(request.call_count, 4)

    def test_invalid_creation_errors_fail_without_sensitive_diagnostics(self):
        for fault in ("created", "extra", "cache", "challenge"):
            with self.subTest(fault=fault), patch.object(demo, "request", side_effect=self.responses(fault)):
                with self.assertRaises(demo.DemoError) as error:
                    demo.verify_creation("Fixture", "http://fixture", VALUES)
                self.assertNotIn(VALUES[demo.NAMES[3]], str(error.exception))
                self.assertNotIn("fixture-admin", str(error.exception))


class UserUpdateTests(unittest.TestCase):
    def test_probes_only_denial_and_absent_target_with_patch(self):
        headers = Message()
        headers["Content-Type"] = "application/json"
        headers["Cache-Control"] = "no-store"
        def reply(url, payload=None, token=None, method=None):
            if url.endswith("/api/auth/login"):
                return demo.HTTPStatus.OK, headers, {"accessToken": "admin-fixture" if payload["email"] == VALUES[demo.NAMES[0]] else "regular-fixture"}
            if method is None:
                self.assertIsNone(payload)
                return demo.HTTPStatus.NOT_FOUND, headers, {"code": demo.PROTECTED_ERRORS[demo.HTTPStatus.NOT_FOUND]}
            self.assertEqual(method, demo.PATCH_METHOD)
            self.assertTrue(url.endswith(demo.UNKNOWN_USER_ID))
            self.assertEqual(payload, {"enabled": False})
            status = demo.HTTPStatus.NOT_FOUND if token == "admin-fixture" else demo.HTTPStatus.FORBIDDEN
            return status, headers, {"code": demo.PROTECTED_ERRORS[status]}
        with patch.object(demo, "request", side_effect=reply) as request, patch("builtins.print"):
            demo.verify_update("Fixture", "http://fixture", VALUES)
        self.assertEqual(request.call_count, 5)

    def test_never_accepts_mutation_success_or_last_admin(self):
        for status in (demo.HTTPStatus.OK, demo.HTTPStatus.CONFLICT):
            headers = Message(); headers["Cache-Control"] = "no-store"
            def reply(url, payload=None, token=None, method=None):
                if url.endswith("/api/auth/login"):
                    return demo.HTTPStatus.OK, headers, {"accessToken": "fixture"}
                if method is None:
                    return demo.HTTPStatus.NOT_FOUND, headers, {"code": demo.PROTECTED_ERRORS[demo.HTTPStatus.NOT_FOUND]}
                return status, headers, {"code": "last_admin"}
            with patch.object(demo, "request", side_effect=reply), self.assertRaises(demo.DemoError):
                demo.verify_update("Fixture", "http://fixture", VALUES)

    def test_existing_probe_target_stops_before_any_patch(self):
        headers = Message(); headers["Cache-Control"] = "no-store"
        def reply(url, payload=None, token=None, method=None):
            self.assertIsNone(method)
            if url.endswith("/api/auth/login"):
                return demo.HTTPStatus.OK, headers, {"accessToken": "fixture"}
            return demo.HTTPStatus.OK, headers, {"id": demo.UNKNOWN_USER_ID}
        with patch.object(demo, "request", side_effect=reply) as request, self.assertRaises(demo.DemoError):
            demo.verify_update("Fixture", "http://fixture", VALUES)
        self.assertEqual(request.call_count, 3)
