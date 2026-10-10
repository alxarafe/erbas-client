"""Small shared-demo defaults resolver and real HTTP provisioning/checks."""
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

NAMES = ("ERBAS_DEMO_ADMIN_EMAIL", "ERBAS_DEMO_ADMIN_PASSWORD",
         "ERBAS_DEMO_USER_EMAIL", "ERBAS_DEMO_USER_PASSWORD")


class DemoError(Exception):
    pass


def parse_defaults(text):
    if "\r" in text or "\0" in text:
        raise DemoError("Demo defaults must not contain CR or NUL.")
    values = {}
    for line in text.split("\n"):
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        if not separator or name not in NAMES or name in values:
            raise DemoError("Expected each of the four demo keys exactly once.")
        values[name] = value
    if set(values) != set(NAMES):
        raise DemoError("All four demo keys are required.")
    return validate_values(values)


def validate_values(values):
    for name in NAMES:
        value = values.get(name)
        if not value or any(char in value for char in "\r\n\0"):
            raise DemoError(f"{name} must be nonempty and contain no CR/LF/NUL.")
    if values[NAMES[0]] == values[NAMES[2]]:
        raise DemoError("Administrator and regular-user emails must differ.")
    return values


def resolve_defaults(path, environment):
    # read_bytes preserves CR so malformed line-oriented data cannot be normalized.
    defaults = parse_defaults(Path(path).read_bytes().decode("utf-8"))
    return validate_values({name: environment.get(name, defaults[name]) for name in NAMES})


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DemoError("Duplicate JSON property.")
        result[key] = value
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def request(url, payload=None, token=None, raw=False):
    headers = {"Accept": "text/plain" if raw else "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers,
                                 data=None if payload is None else json.dumps(payload).encode())
    try:
        response = OPENER.open(req, timeout=7)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(1024 * 1024 + 1)
        require(len(body) <= 1024 * 1024, "Response exceeds demo check limit.")
        if raw:
            return response.status, response.headers, body.decode("utf-8")
        require(response.headers.get_content_type().lower() == "application/json",
                "Expected a JSON response.")
        return response.status, response.headers, json.loads(body, object_pairs_hook=unique_object)


def require(condition, message):
    if not condition:
        raise DemoError(message)


def no_store(headers):
    require("no-store" in [part.strip().lower() for part in headers.get("Cache-Control", "").split(",")],
            "Expected contractual Cache-Control: no-store.")


def login(base, email, password):
    status, headers, body = request(base + "/api/auth/login", {"email": email, "password": password})
    require(status == 200 and isinstance(body, dict) and set(body) == {"accessToken"}
            and isinstance(body["accessToken"], str)
            and re.fullmatch(r"[A-Za-z0-9\-._~+/]+=*", body["accessToken"]) is not None,
            "Login failed or returned an invalid response.")
    no_store(headers)
    return body["accessToken"]


def verify_identity(base, values, admin):
    email_key, password_key = NAMES[:2] if admin else NAMES[2:]
    token = login(base, values[email_key], values[password_key])
    status, headers, body = request(base + "/api/auth/me", token=token)
    require(status == 200 and isinstance(body, dict)
            and set(body) == {"id", "email", "enabled", "admin"}
            and isinstance(body["id"], str) and bool(body["id"])
            and body["email"] == values[email_key]
            and body["enabled"] is True and body["admin"] is admin,
            "Current identity does not match the expected enabled/admin state.")
    no_store(headers)
    return token


def identity_error(label, admin):
    role = "administrator" if admin else "regular user"
    return (f"{label} demo {role} cannot be verified. The persisted demo identity may have been "
            "modified. Reset/recreate the development environment or use matching ERBAS_DEMO_* overrides. "
            "No account credentials or state were reset.")


def verify_backend(label, base, values, provision=False):
    try:
        admin_token = verify_identity(base, values, True)
    except Exception:
        raise DemoError(identity_error(label, True)) from None
    if provision:
        status, headers, body = request(base + "/api/users", {
            "email": values[NAMES[2]], "password": values[NAMES[3]], "admin": False}, admin_token)
        no_store(headers)
        require(status == 201 or (status == 409 and body == {"code": "email_conflict"}),
                f"{label}: regular-user creation failed; response details withheld.")
        if status == 201:
            require(isinstance(body, dict) and set(body) == {"id", "email", "enabled", "admin"}
                    and isinstance(body["id"], str) and bool(body["id"])
                    and body["email"] == values[NAMES[2]] and body["enabled"] is True
                    and body["admin"] is False, f"{label}: unexpected created-user state.")
    try:
        user_token = verify_identity(base, values, False)
    except Exception:
        raise DemoError(identity_error(label, False)) from None
    status, headers, body = request(base + "/api/users", token=user_token)
    require(status == 403 and body == {"code": "forbidden"}, f"{label}: regular-user admin denial failed.")
    no_store(headers)
    require(headers.get("WWW-Authenticate") is None, f"{label}: unexpected forbidden challenge.")
    print(f"OK: {label} administrator and regular-user login/me; regular-user admin denial.")


def check(java, dotnet, client, values):
    for label, url in (("Java direct", java + "/health"), (".NET direct", dotnet + "/health"),
                       ("Client → Java", client + "/backends/java/health"),
                       ("Client → .NET", client + "/backends/dotnet/health")):
        status, _, body = request(url)
        require(status == 200 and body == {"status": "ok"}, f"{label}: Health failed.")
        print(f"OK: {label} Health.")
    status, _, html = request(client + "/", raw=True)
    require(status == 200 and "<app-root>" in html, "Client Angular runtime is unavailable.")
    status, headers, text = request(client + "/demo/defaults.env", raw=True)
    require(status == 200 and parse_defaults(text) == values, "Client runtime demo values differ from effective defaults.")
    no_store(headers)
    print("OK: Client Angular runtime and public demo values match effective shared defaults.")
    for label, base, backend in (("Java", java, "java"), (".NET", dotnet, "dotnet")):
        verify_backend(label, base, values)
        proxy = client + "/backends/" + backend
        for email_key, password_key in (NAMES[:2], NAMES[2:]):
            login(proxy, values[email_key], values[password_key])
            status, headers, body = request(proxy + "/api/auth/login", {
                "email": values[email_key], "password": values[password_key] + "-DEMO-001-incorrect"})
            require(status == 401 and body == {"code": "invalid_credentials"}
                    and headers.get("WWW-Authenticate") == "Bearer", f"{label}: incorrect-password proxy check failed.")
        print(f"OK: Client → {label} administrator/regular login and incorrect-password behavior.")
    print("DEMO CHECK PASS: both identities, direct/proxied Health, login proxies and client runtime defaults.")


def main():
    mode, *args = sys.argv[1:]
    if mode == "defaults" and len(args) == 1:
        values = resolve_defaults(args[0], os.environ)
        for name in NAMES:
            print(name + "=" + values[name])
    elif mode == "provision" and len(args) == 2:
        values = validate_values({name: os.environ.get(name) for name in NAMES})
        for label, base in zip(("Java", ".NET"), args):
            verify_backend(label, base, values, provision=True)
    elif mode == "check" and len(args) == 3:
        check(*args, validate_values({name: os.environ.get(name) for name in NAMES}))
    else:
        raise DemoError("Invalid demo helper invocation.")


if __name__ == "__main__":
    try:
        main()
    except DemoError as error:
        print("ERROR: " + str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Never print HTTP bodies, tokens, credentials, headers or raw exceptions.
        print("ERROR: demo verification failed; response details withheld.", file=sys.stderr)
        sys.exit(1)
