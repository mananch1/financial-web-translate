"""SQLite-backed translation cache, keyed by MD5(language :: source_text).

The hash makes lookups O(1) on the primary key and also keeps the table
small even when sources are long paragraphs (we still store the source
text for debuggability, but it isn't part of the index).
"""
from __future__ import annotations

import hashlib
import sqlite3
import threading
from pathlib import Path

# DB lives next to this module so it's easy to inspect / wipe.
DB_PATH = Path(__file__).resolve().parent / "translation_cache.sqlite"


def cache_key(text: str, lang: str) -> str:
    """MD5 of `lang::text`. Same input + lang -> same key."""
    h = hashlib.md5()
    h.update(lang.lower().encode("utf-8"))
    h.update(b"::")
    h.update(text.encode("utf-8"))
    return h.hexdigest()


class TranslationCache:
    """Thread-safe SQLite cache.

    SQLite itself serialises writes, but we still wrap mutations in a lock
    because `sqlite3.Connection` objects shared across threads need
    `check_same_thread=False` AND coordinated access.
    """

    def __init__(self, db_path: Path | None = None) -> None:
        self._path = db_path or DB_PATH
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(
            str(self._path),
            check_same_thread=False,
            isolation_level=None,  # autocommit; we batch via explicit BEGIN if needed
        )
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS translations (
                hash        TEXT PRIMARY KEY,
                lang        TEXT NOT NULL,
                source      TEXT NOT NULL,
                translation TEXT NOT NULL,
                model       TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    # ----- reads --------------------------------------------------------

    def get(self, text: str, lang: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT translation FROM translations WHERE hash = ?",
                (cache_key(text, lang),),
            ).fetchone()
        return row[0] if row else None

    def get_many(self, texts: list[str], lang: str) -> list[str | None]:
        """Return a same-length list with translation-or-None for each text."""
        return [self.get(t, lang) for t in texts]

    # ----- writes -------------------------------------------------------

    def put(self, text: str, lang: str, translation: str, model: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO translations (hash, lang, source, translation, model)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(hash) DO UPDATE SET
                    translation = excluded.translation,
                    model       = excluded.model,
                    created_at  = CURRENT_TIMESTAMP
                """,
                (cache_key(text, lang), lang.lower(), text, translation, model),
            )

    def put_many(
        self,
        items: list[tuple[str, str, str]],
        model: str,
    ) -> None:
        """items = [(source_text, lang, translation), ...]"""
        if not items:
            return
        rows = [
            (cache_key(src, lang), lang.lower(), src, translation, model)
            for src, lang, translation in items
        ]
        with self._lock:
            self._conn.executemany(
                """
                INSERT INTO translations (hash, lang, source, translation, model)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(hash) DO UPDATE SET
                    translation = excluded.translation,
                    model       = excluded.model,
                    created_at  = CURRENT_TIMESTAMP
                """,
                rows,
            )

    # ----- admin --------------------------------------------------------

    def size(self) -> int:
        with self._lock:
            return self._conn.execute(
                "SELECT COUNT(*) FROM translations"
            ).fetchone()[0]

    def clear(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM translations")

    def close(self) -> None:
        with self._lock:
            self._conn.close()
