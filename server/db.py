"""One small SQL adapter: SQLite for development, PostgreSQL for durable hosting."""
import contextlib
import os
import sqlite3
import threading
import time
import uuid

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS task_nodes (
    run_id TEXT NOT NULL, node_id TEXT NOT NULL, objective TEXT NOT NULL,
    status TEXT NOT NULL, dependencies TEXT NOT NULL, acceptance TEXT NOT NULL,
    evidence TEXT NOT NULL, updated DOUBLE PRECISION NOT NULL,
    PRIMARY KEY(run_id,node_id))""",
    """CREATE TABLE IF NOT EXISTS provider_models (
    id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL,
    label TEXT NOT NULL, tier TEXT NOT NULL, status TEXT NOT NULL,
    updated DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
    plan TEXT NOT NULL DEFAULT 'free', created DOUBLE PRECISION NOT NULL,
    prefs TEXT NOT NULL DEFAULT '{}')""",
    """CREATE TABLE IF NOT EXISTS sessions (
    digest TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
    updated DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, role TEXT NOT NULL,
    content TEXT NOT NULL, images TEXT NOT NULL DEFAULT '[]', meta TEXT NOT NULL DEFAULT '{}',
    created DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL, day TEXT NOT NULL, metric TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(user_id, day, metric))""",
    """CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, chat_id TEXT NOT NULL,
    status TEXT NOT NULL, objective TEXT NOT NULL, strategy TEXT NOT NULL,
    checkpoint TEXT NOT NULL DEFAULT '{}', created DOUBLE PRECISION NOT NULL,
    updated DOUBLE PRECISION NOT NULL, error TEXT NOT NULL DEFAULT '')""",
    """CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, kind TEXT NOT NULL,
    payload TEXT NOT NULL, created DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS files (
    user_id TEXT NOT NULL, chat_id TEXT NOT NULL, path TEXT NOT NULL,
    content TEXT NOT NULL, updated DOUBLE PRECISION NOT NULL,
    PRIMARY KEY(user_id, chat_id, path))""",
    """CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, name TEXT NOT NULL,
    status TEXT NOT NULL, result TEXT NOT NULL, created DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, scope TEXT NOT NULL,
    project TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, provenance TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    created DOUBLE PRECISION NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL,
    detail TEXT NOT NULL, created DOUBLE PRECISION NOT NULL)""",
    "CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id,created)",
    "CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id,status)",
    "CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id,created)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
]


def uid():
    return uuid.uuid4().hex


class Database:
    def __init__(self, url=None):
        self.url = url or os.getenv("DATABASE_URL", "")
        self.pg = self.url.startswith(("postgres://", "postgresql://"))
        self.lock = threading.RLock()
        self._depth = 0  # >0 while inside an explicit transaction; no silent reconnect then
        self._retry_errors = ()
        if self.pg:
            import psycopg
            self._psycopg = psycopg
            self._retry_errors = (psycopg.OperationalError, psycopg.InterfaceError)
            self._connect()
        else:
            path = self.url or os.getenv("SQLITE_PATH", ":memory:" if os.getenv("VERCEL") else "data.db")
            self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
            self.conn.row_factory = sqlite3.Row
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA busy_timeout=5000")
        for statement in SCHEMA:
            self.execute(statement)

    def _connect(self):
        from psycopg.rows import dict_row
        # Keepalives stop managed PostgreSQL from silently dropping an idle serverless connection.
        self.conn = self._psycopg.connect(
            self.url, autocommit=True, row_factory=dict_row, connect_timeout=10,
            keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=3)

    def execute(self, sql, args=()):
        with self.lock:
            query = sql.replace("?", "%s") if self.pg else sql
            try:
                return self.conn.execute(query, args)
            except self._retry_errors:
                # The server closed the connection (idle timeout, deploy, failover).
                # Reconnect and repeat once, but never inside a transaction: half-applied
                # work must fail loudly instead of being replayed.
                if self._depth:
                    raise
                try:
                    self.conn.close()
                except Exception:
                    pass
                self._connect()
                return self.conn.execute(query, args)

    def one(self, sql, args=()):
        with self.lock:
            row = self.execute(sql, args).fetchone()
            return dict(row) if row else None

    def all(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.execute(sql, args).fetchall()]

    @contextlib.contextmanager
    def transaction(self, user_id=None):
        with self.lock:
            if self.pg:
                if not self._depth:
                    self.execute("SELECT 1")  # reconnects first if the connection went stale
                self._depth += 1
                try:
                    with self.conn.transaction():
                        if user_id:
                            self.execute("SELECT id FROM users WHERE id=? FOR UPDATE", (user_id,))
                        yield
                finally:
                    self._depth -= 1
            else:
                self.conn.execute("BEGIN IMMEDIATE")
                try:
                    yield
                    self.conn.execute("COMMIT")
                except BaseException:
                    self.conn.execute("ROLLBACK")
                    raise

    def audit(self, user, action, detail=""):
        self.execute("INSERT INTO audit VALUES (?,?,?,?,?)", (uid(), user, action, detail, time.time()))
