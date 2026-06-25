// src/db.js
// SQLite database connection + schema. Zero-config file DB so the team can run
// immediately; swap to PostgreSQL/MySQL later without changing the route logic much.
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'hris.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema -----------------------------------------------------------------
// Roles are stored as a fixed set of codes used by the RBAC layer:
//   super_admin | hr | manager | employee
db.exec(`
CREATE TABLE IF NOT EXISTS departments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','hr','manager','employee')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  employee_code       TEXT UNIQUE,
  full_name           TEXT NOT NULL,
  cnic                TEXT,
  date_of_birth       TEXT,
  gender              TEXT,
  marital_status      TEXT,
  address             TEXT,
  phone               TEXT,
  email               TEXT,
  department_id       INTEGER REFERENCES departments(id),
  designation         TEXT,
  manager_id          INTEGER REFERENCES employees(id),
  date_of_joining     TEXT,
  employment_status   TEXT DEFAULT 'active',
  probation_end       TEXT,
  date_of_termination TEXT,
  termination_reason  TEXT,
  shift               TEXT,
  salary              REAL,
  bank_name           TEXT,
  iban                TEXT,
  emergency_name      TEXT,
  emergency_relation  TEXT,
  emergency_phone     TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id      INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type       TEXT NOT NULL CHECK (leave_type IN ('annual','casual','sick','unpaid')),
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by       INTEGER REFERENCES employees(id),
  decided_at       TEXT,
  rejection_reason TEXT,
  paid_status      TEXT CHECK (paid_status IN ('paid','unpaid')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  expires_on  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_openings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  description   TEXT,
  shift         TEXT,
  salary        REAL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS candidates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id        INTEGER NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  resume_stored TEXT,
  resume_name   TEXT,
  status        TEXT NOT NULL DEFAULT 'applied'
                CHECK (status IN ('applied','shortlisted','interview_scheduled','hired','rejected')),
  interview_at  TEXT,
  feedback      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed default shifts on first run.
if (db.prepare('SELECT COUNT(*) AS n FROM shifts').get().n === 0) {
  ['Morning (8am-4pm)', 'Afternoon (2pm-10pm)', 'Night (10pm-6am)', 'Flexible'].forEach(name => {
    db.prepare('INSERT OR IGNORE INTO shifts (name) VALUES (?)').run(name);
  });
}

// Migrations for existing databases.
try { db.exec('ALTER TABLE leave_requests ADD COLUMN rejection_reason TEXT'); } catch {}
try { db.exec('ALTER TABLE leave_requests ADD COLUMN paid_status TEXT'); } catch {}
try { db.exec('ALTER TABLE employees ADD COLUMN shift TEXT'); } catch {}
try { db.exec('ALTER TABLE employees ADD COLUMN date_of_termination TEXT'); } catch {}
try { db.exec('ALTER TABLE employees ADD COLUMN termination_reason TEXT'); } catch {}
try { db.exec("UPDATE employees SET date_of_termination = contract_end WHERE contract_end IS NOT NULL AND date_of_termination IS NULL"); } catch {}
try { db.exec('ALTER TABLE job_openings ADD COLUMN shift TEXT'); } catch {}
try { db.exec('ALTER TABLE job_openings ADD COLUMN salary REAL'); } catch {}

// Migrate candidates: replace 'selected' status with 'hired'.
try {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidates'").get();
  if (schema && schema.sql && schema.sql.includes("'selected'")) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      ALTER TABLE candidates RENAME TO _candidates_bk;
      CREATE TABLE candidates (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id        INTEGER NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
        full_name     TEXT NOT NULL,
        email         TEXT,
        phone         TEXT,
        resume_stored TEXT,
        resume_name   TEXT,
        status        TEXT NOT NULL DEFAULT 'applied'
                      CHECK (status IN ('applied','shortlisted','interview_scheduled','hired','rejected')),
        interview_at  TEXT,
        feedback      TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO candidates SELECT id,job_id,full_name,email,phone,resume_stored,resume_name,
        CASE WHEN status='selected' THEN 'hired' ELSE status END,
        interview_at,feedback,created_at FROM _candidates_bk;
      DROP TABLE _candidates_bk;
    `);
    db.pragma('foreign_keys = ON');
  }
} catch(e) { console.warn('Candidates migration:', e.message); }

export function audit(userId, action, detail = '') {
  db.prepare('INSERT INTO audit_logs (user_id, action, detail) VALUES (?,?,?)')
    .run(userId ?? null, action, detail);
}

export function notify(userId, type, title, body = '') {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)')
    .run(userId, type, title, body);
}

export default db;
