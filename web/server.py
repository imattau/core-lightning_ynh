#!/usr/bin/env python3
"""Small localhost-only CLN web API and static-file server.

Mutating operations are deliberately narrow and require explicit confirmation
in the request body. Recovery material is returned only by the guarded reveal
route and is never written to logs, URLs, or persistent browser storage.
"""

import json
import os
import re
import subprocess
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


LISTEN = os.environ.get("CLN_WEB_LISTEN", "127.0.0.1:8090")
STATIC_DIR = Path(os.environ.get("CLN_WEB_STATIC_DIR", ".")).resolve()
RPC_BIN = os.environ.get("CLN_RPC_BIN", "lightning-cli")
LIGHTNING_DIR = os.environ.get("CLN_LIGHTNING_DIR", "")
HSMTOOL = os.environ.get("CLN_HSMTOOL", "lightning-hsmtool")
HSM_SECRET = os.environ.get("CLN_HSM_SECRET", "")
RPC_TIMEOUT = 15
NODE_ID_RE = re.compile(r"^[0-9a-fA-F]{66}$")
NODE_SETTINGS = {
    "alias": {"rpc": "alias", "kind": "string"},
    "announce_addr": {"rpc": "announce-addr", "kind": "string"},
    "rgb": {"rpc": "rgb", "kind": "rgb"},
    "fee_base": {"rpc": "fee-base", "kind": "integer"},
    "fee_per_sat": {"rpc": "fee-per-satoshi", "kind": "integer"},
    "min_capacity_sat": {"rpc": "min-capacity-sat", "kind": "integer"},
    "log_level": {"rpc": "log-level", "kind": "log_level"},
}


def rpc(method, *args):
    command = [RPC_BIN]
    if LIGHTNING_DIR:
        command.extend(["--lightning-dir", LIGHTNING_DIR])
    command.append(method)
    command.extend(args)
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=RPC_TIMEOUT,
    )
    if completed.returncode != 0:
        raise RuntimeError("Core Lightning RPC request failed")
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Core Lightning returned invalid JSON") from exc


def recovery_secret():
    if not HSM_SECRET:
        raise RuntimeError("Recovery secret is not configured")
    tool = HSMTOOL
    if not os.access(tool, os.X_OK):
        fallback = Path(tool).parent.parent / "tools" / "lightning-hsmtool"
        if os.access(fallback, os.X_OK):
            tool = str(fallback)
    completed = subprocess.run(
        [tool, "getsecret", HSM_SECRET],
        check=False,
        capture_output=True,
        text=True,
        timeout=RPC_TIMEOUT,
    )
    if completed.returncode != 0 or not completed.stdout.strip():
        raise RuntimeError("Recovery phrase is unavailable")
    return completed.stdout.strip()


def json_bytes(value):
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


def msat_value(value):
    if isinstance(value, dict):
        value = value.get("msat", 0)
    if isinstance(value, str):
        value = value.removesuffix("msat")
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def validate_peer_id(value):
    if not isinstance(value, str) or not NODE_ID_RE.fullmatch(value):
        raise RuntimeError("Peer node ID must be 66 hexadecimal characters")
    return value


def validate_channel_amount(value):
    if isinstance(value, bool):
        raise RuntimeError("Channel amount must be an integer")
    try:
        amount = int(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("Channel amount must be an integer") from exc
    if amount < 546 or amount > 16777215:
        raise RuntimeError("Channel amount must be between 546 and 16777215 satoshis")
    return amount


def validate_node_setting(key, value):
    setting = NODE_SETTINGS.get(key)
    if not setting:
        raise RuntimeError("Unsupported node setting")
    kind = setting["kind"]
    if kind == "string":
        if not isinstance(value, str) or len(value) > 255:
            raise RuntimeError("This node setting must be text no longer than 255 characters")
        if key == "announce_addr" and any(char.isspace() for char in value):
            raise RuntimeError("The announce address must not contain whitespace")
        return value
    if kind == "rgb":
        if not isinstance(value, str) or not re.fullmatch(r"[0-9a-fA-F]{6}", value):
            raise RuntimeError("Node color must be exactly six hexadecimal characters")
        return value.upper()
    if kind == "log_level":
        if value not in ("info", "debug", "io"):
            raise RuntimeError("Log level must be info, debug, or io")
        return value
    if isinstance(value, bool):
        raise RuntimeError("Node amount settings must be integers")
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("Node amount settings must be integers") from exc
    if number < 0 or number > 16777215:
        raise RuntimeError("Node amount settings must be between 0 and 16777215")
    return str(number)


def node_settings():
    configs = rpc("listconfigs")
    values = configs.get("configs", configs)
    if isinstance(values, list):
        values = {item.get("config"): item for item in values if isinstance(item, dict) and item.get("config")}

    def typed_value(record):
        if not isinstance(record, dict):
            return record
        for field in ("value_str", "value_int", "value_msat", "value_bool", "value"):
            if field in record:
                return record[field]
        if record.get("values_str"):
            return record["values_str"][0]
        if record.get("values_int"):
            return record["values_int"][0]
        return None

    result = {}
    for key, setting in NODE_SETTINGS.items():
        value = typed_value(values.get(setting["rpc"]))
        if value is not None:
            result[key] = value
    # getinfo is the authoritative live source for the two announcement
    # fields, and also keeps the form useful across CLN versions which omit
    # default-valued records from listconfigs.
    info = rpc("getinfo")
    result.setdefault("alias", info.get("alias"))
    result.setdefault("rgb", info.get("color"))
    result.setdefault("fee_base", 1000)
    result.setdefault("fee_per_sat", 10)
    result.setdefault("min_capacity_sat", 10000)
    result.setdefault("log_level", "info")
    return result


def validate_origin(handler):
    origin = handler.headers.get("Origin")
    if not origin:
        return
    from urllib.parse import urlparse as parse_url
    if parse_url(origin).netloc != handler.headers.get("Host"):
        raise RuntimeError("Cross-origin requests are not allowed")


class Handler(BaseHTTPRequestHandler):
    server_version = "CoreLightningWeb/0.1"

    def log_message(self, fmt, *args):
        # Do not log request bodies or query strings: future recovery routes
        # must never be able to put secret material in the service log.
        print("cln-web: " + fmt % args, flush=True)

    def send_json(self, status, value):
        body = json_bytes(value)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 16 * 1024:
                raise ValueError
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            raise RuntimeError("Invalid request body")

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler API
        path = urlparse(self.path).path
        try:
            if path == "/api/v1/status":
                info = rpc("getinfo")
                funds = rpc("listfunds")
                peers = rpc("listpeers")
                self.send_json(HTTPStatus.OK, {
                    "online": True,
                    "node": {
                        "id": info.get("id"),
                        "alias": info.get("alias"),
                        "network": info.get("network"),
                        "version": info.get("version"),
                    },
                    "channels": len(funds.get("channels", [])),
                    "peers": sum(1 for peer in peers.get("peers", []) if peer.get("connected")),
                    "outputs": len(funds.get("outputs", [])),
                })
                return
            if path == "/api/v1/wallet":
                funds = rpc("listfunds")
                outputs = funds.get("outputs", [])
                confirmed_msat = sum(
                    msat_value(output.get("amount_msat", 0))
                    for output in outputs
                    if output.get("status") == "confirmed"
                )
                self.send_json(HTTPStatus.OK, {
                    "onchain_confirmed_msat": confirmed_msat,
                    "channels": funds.get("channels", []),
                    "outputs": outputs,
                })
                return
            if path == "/api/v1/peers":
                peers = rpc("listpeers")
                self.send_json(HTTPStatus.OK, peers)
                return
            if path == "/api/v1/peers/discovered":
                nodes = rpc("listnodes")
                discovered = []
                for node in nodes.get("nodes", []):
                    addresses = node.get("addresses") or []
                    if not isinstance(node.get("nodeid"), str) or not NODE_ID_RE.fullmatch(node["nodeid"]) or not addresses:
                        continue
                    discovered.append({
                        "id": node["nodeid"],
                        "alias": node.get("alias") or "Unnamed peer",
                        "addresses": addresses,
                        "last_timestamp": node.get("last_timestamp", 0),
                    })
                discovered.sort(key=lambda item: item.get("last_timestamp", 0), reverse=True)
                self.send_json(HTTPStatus.OK, {"peers": discovered[:50]})
                return
            if path == "/api/v1/health":
                self.send_json(HTTPStatus.OK, {"ok": True})
                return
            if path == "/api/v1/node/settings":
                self.send_json(HTTPStatus.OK, {"settings": node_settings()})
                return
            self.serve_static(path)
        except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": str(exc)})

    def do_POST(self):  # noqa: N802 - BaseHTTPRequestHandler API
        path = urlparse(self.path).path
        if path not in ("/api/v1/wallet/address", "/api/v1/peers/connect", "/api/v1/channels/open", "/api/v1/recovery/reveal", "/api/v1/node/settings"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        try:
            validate_origin(self)
            payload = self.read_json()
            if path == "/api/v1/recovery/reveal":
                if payload.get("confirm") is not True:
                    raise RuntimeError("Explicit recovery phrase confirmation is required")
                self.send_json(HTTPStatus.OK, {"recovery_phrase": recovery_secret()})
                return
            if path == "/api/v1/node/settings":
                if not isinstance(payload.get("settings"), dict) or not payload["settings"]:
                    raise RuntimeError("No node settings were provided")
                updated = {}
                for key, value in payload["settings"].items():
                    validated = validate_node_setting(key, value)
                    updated[key] = rpc("setconfig", NODE_SETTINGS[key]["rpc"], validated)
                self.send_json(HTTPStatus.OK, {"updated": list(updated), "settings": node_settings()})
                return
            if path == "/api/v1/wallet/address":
                address = rpc("newaddr", "bech32")
                self.send_json(HTTPStatus.OK, address)
                return

            peer_id = validate_peer_id(payload.get("peer_id"))
            if path == "/api/v1/peers/connect":
                host = payload.get("host")
                port = payload.get("port")
                if host is not None:
                    if not isinstance(host, str) or not host or any(char.isspace() for char in host):
                        raise RuntimeError("Peer host must be a non-empty value without whitespace")
                    try:
                        port = int(port)
                    except (TypeError, ValueError) as exc:
                        raise RuntimeError("Peer port must be an integer") from exc
                    if port < 1 or port > 65535:
                        raise RuntimeError("Peer port must be between 1 and 65535")
                    result = rpc("connect", peer_id, host, str(port))
                else:
                    result = rpc("connect", peer_id)
                self.send_json(HTTPStatus.OK, result)
                return

            if payload.get("confirm") is not True:
                raise RuntimeError("Explicit channel funding confirmation is required")
            amount = validate_channel_amount(payload.get("amount_sat"))
            public = payload.get("public", False)
            if not isinstance(public, bool):
                raise RuntimeError("Public channel must be true or false")
            result = rpc("fundchannel", peer_id, str(amount), "normal", str(public).lower())
            self.send_json(HTTPStatus.OK, result)
        except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
            status = HTTPStatus.BAD_REQUEST if isinstance(exc, RuntimeError) else HTTPStatus.SERVICE_UNAVAILABLE
            self.send_json(status, {"error": str(exc)})

    def serve_static(self, path):
        relative = path.lstrip("/") or "index.html"
        candidate = (STATIC_DIR / relative).resolve()
        if STATIC_DIR not in candidate.parents and candidate != STATIC_DIR:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        if not candidate.is_file():
            candidate = STATIC_DIR / "index.html"
        content_type = "text/html; charset=utf-8"
        if candidate.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif candidate.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        body = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    host, port = LISTEN.rsplit(":", 1)
    server = ThreadingHTTPServer((host, int(port)), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
