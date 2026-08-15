"""Workbench Module 1 API: standard-library HTTP plus a minimal Redis client."""

from __future__ import annotations

import hashlib
import json
import os
import signal
import socket
import sys
import threading
import time
from contextlib import contextmanager
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, BinaryIO, Iterator
from urllib.parse import parse_qs, urlsplit


SERVICE = "workbench-api"
BIND_HOST = os.environ.get("WORKBENCH_BIND_HOST", "0.0.0.0")
PORT = int(os.environ.get("WORKBENCH_PORT", "8080"))
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_TIMEOUT_SECONDS = 2.0
MAX_BODY_BYTES = 64 * 1024
MAX_SLOW_SECONDS = 10.0

DRAINING = threading.Event()
LOG_LOCK = threading.Lock()
INFLIGHT_LOCK = threading.Lock()
INFLIGHT = 0
SERVER: ThreadingHTTPServer | None = None


def log(event: str, level: str = "info", **fields: Any) -> None:
    """Emit a deterministic, one-object-per-line structured log."""
    record: dict[str, Any] = {
        "event": event,
        "level": level,
        "service": SERVICE,
        "timestamp": datetime.now(UTC).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        ),
    }
    record.update(fields)
    with LOG_LOCK:
        sys.stdout.write(json.dumps(record, separators=(",", ":"), sort_keys=True) + "\n")
        sys.stdout.flush()


@contextmanager
def request_scope(method: str, path: str, request_id: str) -> Iterator[None]:
    global INFLIGHT
    started = time.monotonic()
    with INFLIGHT_LOCK:
        INFLIGHT += 1
        current = INFLIGHT
    log(
        "request_started",
        method=method,
        path=path,
        request_id=request_id,
        inflight=current,
    )
    try:
        yield
    finally:
        with INFLIGHT_LOCK:
            INFLIGHT -= 1
            current = INFLIGHT
        log(
            "request_completed",
            method=method,
            path=path,
            request_id=request_id,
            inflight=current,
            duration_ms=round((time.monotonic() - started) * 1000, 3),
        )


def _encode_resp(parts: tuple[str, ...]) -> bytes:
    encoded = [f"*{len(parts)}\r\n".encode("ascii")]
    for part in parts:
        value = part.encode("utf-8")
        encoded.append(f"${len(value)}\r\n".encode("ascii"))
        encoded.append(value + b"\r\n")
    return b"".join(encoded)


def _read_line(stream: BinaryIO) -> bytes:
    line = stream.readline()
    if not line.endswith(b"\r\n"):
        raise RuntimeError("Redis returned a truncated RESP line")
    return line[:-2]


def _read_resp(stream: BinaryIO) -> str | int | bytes | None | list[Any]:
    prefix = stream.read(1)
    if prefix == b"+":
        return _read_line(stream).decode("utf-8")
    if prefix == b"-":
        raise RuntimeError(f"Redis error: {_read_line(stream).decode('utf-8')}")
    if prefix == b":":
        return int(_read_line(stream))
    if prefix == b"$":
        length = int(_read_line(stream))
        if length == -1:
            return None
        payload = stream.read(length)
        if stream.read(2) != b"\r\n":
            raise RuntimeError("Redis returned a truncated RESP bulk string")
        return payload
    if prefix == b"*":
        length = int(_read_line(stream))
        return [_read_resp(stream) for _ in range(length)]
    raise RuntimeError(f"unsupported Redis RESP prefix: {prefix!r}")


def redis_command(*parts: str) -> str | int | bytes | None | list[Any]:
    with socket.create_connection(
        (REDIS_HOST, REDIS_PORT), timeout=REDIS_TIMEOUT_SECONDS
    ) as connection:
        connection.settimeout(REDIS_TIMEOUT_SECONDS)
        connection.sendall(_encode_resp(parts))
        with connection.makefile("rb") as stream:
            return _read_resp(stream)


def redis_ready() -> bool:
    try:
        return redis_command("PING") == "PONG"
    except (OSError, RuntimeError, ValueError):
        return False


class WorkbenchServer(ThreadingHTTPServer):
    daemon_threads = False
    block_on_close = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Workbench"
    sys_version = ""

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, _format: str, *args: Any) -> None:
        # BaseHTTPRequestHandler's unstructured stderr log is replaced by log().
        return

    def _request_id(self, query: dict[str, list[str]]) -> str:
        supplied = self.headers.get("X-Request-ID") or query.get("request_id", [""])[0]
        if supplied:
            return supplied[:128]
        seed = f"{time.time_ns()}:{self.client_address[0]}:{self.path}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]

    def _send(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            log("response_disconnected", level="warning", path=self.path)

    def _read_json(self) -> dict[str, Any]:
        raw_length = self.headers.get("Content-Length")
        if raw_length is None:
            raise ValueError("Content-Length is required")
        try:
            length = int(raw_length)
        except ValueError as error:
            raise ValueError("Content-Length must be an integer") from error
        if length < 0 or length > MAX_BODY_BYTES:
            raise ValueError(f"body must be between 0 and {MAX_BODY_BYTES} bytes")
        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError as error:
            raise ValueError("body must be valid JSON") from error
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        request_id = self._request_id(query)
        with request_scope("GET", parsed.path, request_id):
            if parsed.path == "/healthz":
                healthy = redis_ready()
                self._send(
                    HTTPStatus.OK if healthy else HTTPStatus.SERVICE_UNAVAILABLE,
                    {
                        "bind_host": BIND_HOST,
                        "redis": "ok" if healthy else "unavailable",
                        "status": "ok" if healthy else "unhealthy",
                    },
                )
                return

            if parsed.path == "/readyz":
                ready = not DRAINING.is_set() and redis_ready()
                self._send(
                    HTTPStatus.OK if ready else HTTPStatus.SERVICE_UNAVAILABLE,
                    {"draining": DRAINING.is_set(), "ready": ready},
                )
                return

            if DRAINING.is_set():
                self._send(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "draining"})
                return

            if parsed.path == "/":
                self._send(
                    HTTPStatus.OK,
                    {
                        "service": SERVICE,
                        "endpoints": ["/healthz", "/readyz", "/documents", "/slow"],
                    },
                )
                return

            if parsed.path == "/slow":
                raw_seconds = query.get("seconds", ["3"])[0]
                try:
                    seconds = float(raw_seconds)
                except ValueError:
                    self._send(HTTPStatus.BAD_REQUEST, {"error": "seconds must be numeric"})
                    return
                if not 0 <= seconds <= MAX_SLOW_SECONDS:
                    self._send(
                        HTTPStatus.BAD_REQUEST,
                        {"error": f"seconds must be between 0 and {MAX_SLOW_SECONDS:g}"},
                    )
                    return
                time.sleep(seconds)
                self._send(
                    HTTPStatus.OK,
                    {"request_id": request_id, "slept_seconds": seconds, "status": "completed"},
                )
                return

            self._send(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        request_id = self._request_id(query)
        with request_scope("POST", parsed.path, request_id):
            if DRAINING.is_set():
                self._send(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "draining"})
                return
            if parsed.path != "/documents":
                self._send(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                payload = self._read_json()
                text = payload.get("text")
                if not isinstance(text, str) or not text:
                    raise ValueError("text must be a non-empty string")
                digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
                request_count = redis_command("INCR", "workbench:requests")
                redis_command("SET", f"workbench:document:{digest}", str(len(text)))
            except ValueError as error:
                self._send(HTTPStatus.BAD_REQUEST, {"error": str(error)})
                return
            except (OSError, RuntimeError) as error:
                log("redis_error", level="error", error=str(error), request_id=request_id)
                self._send(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Redis unavailable"})
                return

            self._send(
                HTTPStatus.CREATED,
                {
                    "document_id": digest,
                    "redis_request_count": request_count,
                    "text_bytes": len(text.encode("utf-8")),
                },
            )


def handle_signal(signum: int, _frame: Any) -> None:
    if DRAINING.is_set():
        return
    DRAINING.set()
    with INFLIGHT_LOCK:
        current = INFLIGHT
    signal_name = signal.Signals(signum).name
    log("drain_started", signal=signal_name, inflight=current)
    if SERVER is not None:
        threading.Thread(target=SERVER.shutdown, name="http-shutdown", daemon=True).start()


def main() -> int:
    global SERVER
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    SERVER = WorkbenchServer((BIND_HOST, PORT), Handler)
    log(
        "server_started",
        bind_host=BIND_HOST,
        port=PORT,
        pid=os.getpid(),
        uid=os.getuid(),
        gid=os.getgid(),
        redis_host=REDIS_HOST,
        redis_port=REDIS_PORT,
    )
    if redis_ready():
        log("redis_ready", redis_host=REDIS_HOST, redis_port=REDIS_PORT)
    else:
        log("redis_not_ready", level="warning", redis_host=REDIS_HOST, redis_port=REDIS_PORT)

    try:
        SERVER.serve_forever(poll_interval=0.1)
    finally:
        SERVER.server_close()
        with INFLIGHT_LOCK:
            current = INFLIGHT
        log("drain_complete", inflight=current)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
