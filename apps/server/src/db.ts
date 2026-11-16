/**
 * Persistence: SQLite through Node's built-in `node:sqlite` (no native dependencies).
 *
 * Design notes:
 *  - Content (skills, challenges) lives in git under /content, NOT in the database.
 *    The database only stores what YOU did: attempts, events, submissions, evidence, journal.
 *  - `evidence` is append-only. Skill state is computed from it (see core/mastery.ts),
 *    never stored as the source of truth.
 *  - Migrations are numbered and tracked with SQLite's `user_version` pragma.
 *    Never edit a migration that has already run: add a new one.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MIGRATIONS: string[] = [
  /* 1: initial schema */ `
  CREATE TABLE attempts (
    id            INTEGER PRIMARY KEY,
    challenge_id  TEXT NOT NULL,
    started_at    TEXT NOT NULL,
    ended_at      TEXT,
    status        TEXT NOT NULL DEFAULT 'in_progress',
    independence  TEXT
  );
  CREATE INDEX attempts_challenge ON attempts(challenge_id);

  CREATE TABLE attempt_events (
    id          INTEGER PRIMARY KEY,
    attempt_id  INTEGER NOT NULL REFERENCES attempts(id),
    ts          TEXT NOT NULL,
    kind        TEXT NOT NULL,
    provenance  TEXT NOT NULL CHECK (provenance IN ('observed','manual','inferred')),
    payload     TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX events_attempt ON attempt_events(attempt_id, ts);

  CREATE TABLE submissions (
    id                 INTEGER PRIMARY KEY,
    attempt_id         INTEGER NOT NULL REFERENCES attempts(id),
    created_at         TEXT NOT NULL,
    code               TEXT NOT NULL,
    explanation        TEXT NOT NULL,
    used_outside_help  INTEGER NOT NULL,
    test_results       TEXT NOT NULL
  );

  CREATE TABLE evidence (
    id          INTEGER PRIMARY KEY,
    skill_id    TEXT NOT NULL,
    level       INTEGER NOT NULL,
    polarity    INTEGER NOT NULL CHECK (polarity IN (-1, 1)),
    kind        TEXT NOT NULL,
    context     TEXT,
    ref_type    TEXT NOT NULL,
    ref_id      TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX evidence_skill ON evidence(skill_id, created_at);

  CREATE TABLE daily_plans (
    date               TEXT PRIMARY KEY,
    challenge_id       TEXT NOT NULL,
    rationale          TEXT NOT NULL,
    overridden         INTEGER NOT NULL DEFAULT 0,
    override_reason    TEXT
  );

  CREATE TABLE journal_entries (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    attempt_id  INTEGER REFERENCES attempts(id),
    fields      TEXT NOT NULL,
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  -- Full-text search over the journal. 'body' is all fields flattened to text.
  CREATE VIRTUAL TABLE journal_fts USING fts5(title, body, content='', contentless_delete=1);
  `,
];

export type DB = DatabaseSync;

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

export const nowIso = () => new Date().toISOString();
