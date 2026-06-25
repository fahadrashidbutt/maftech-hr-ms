# MAFTECH HRIS — Starter (HR Module)

A runnable full-stack starter for the MAFTECH HRIS. This covers the HR-facing
slice of the system so you have a working foundation to build the rest of the
modules on.

## What's included

- **RBAC authentication** — JWT login with four roles: Super Administrator, HR,
  Manager, Employee. Failed-login lockout and role-scoped data access.
- **HR Dashboard** — total employees, new joiners (30 days), on leave today,
  pending leave requests, and upcoming contract expiries.
- **Employee directory** — searchable list, full profiles, add new employees.
- **Document repository** — per-employee uploads (Appointment Letter, Contract,
  CNIC, certificates, etc.) with download and optional expiry dates.
- **Leave workflow** — employee submits → manager/HR is notified → approve or
  reject → employee is notified.
- **Recruitment** — job openings, candidates with resume upload, and status
  tracking (applied → shortlisted → interview scheduled → selected → rejected).
- **Notifications** — generated on leave events, plus an on-demand "check for
  events" that surfaces upcoming birthdays, probation completion, and contract
  or document expiry.

## Tech stack

- **Backend:** Node.js + Express, SQLite (via better-sqlite3), JWT, multer for
  file uploads.
- **Frontend:** React + Vite, React Router.
- The data layer is plain SQL, so moving to PostgreSQL or MySQL later is mostly
  a matter of swapping the driver and connection in `backend/src/db.js`.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm

## Running it

Open two terminals.

**1. Backend**

```bash
cd backend
cp .env.example .env        # then edit JWT_SECRET for anything beyond local dev
npm install
npm run seed                # creates hris.db with demo data + accounts
npm start                   # API on http://localhost:4000
```

**2. Frontend**

```bash
cd frontend
npm install
npm run dev                 # app on http://localhost:5173
```

Open http://localhost:5173 and sign in.

## Demo accounts

All use the password **`password123`**:

| Email                  | Role                |
|------------------------|---------------------|
| admin@maftech.com      | Super Administrator |
| hr@maftech.com         | HR                  |
| manager@maftech.com    | Manager (Engineering) |
| employee@maftech.com   | Employee            |

Sign in as each to see how the interface and permissions change by role. For
example, the Employee only sees their own profile and can submit leave; the
Manager sees their department and can approve it.

## Project layout

```
backend/
  server.js              Express app + route mounting
  src/
    db.js                SQLite connection, schema, notify()/audit() helpers
    auth.js              JWT + RBAC permission map and middleware
    seed.js              Demo data
    routes/              auth, employees, leave, documents, recruitment, dashboard
  uploads/               Uploaded files land here (gitignored)
frontend/
  src/
    api.js               fetch wrapper for the API
    auth.jsx             React auth context + client-side permission checks
    pages/               Login, Dashboard, Employees, EmployeeDetail, Leave,
                         Recruitment, Notifications
    styles.css           All styling
```

## Notes & next steps

- **Security is enforced on the backend.** The frontend hides controls a role
  can't use, but every route re-checks permissions server-side.
- The notification "check for events" endpoint is a stand-in for a scheduled
  job — in production you'd run it on a cron/worker instead of on demand.
- Natural next modules to add on this foundation: attendance, payroll,
  performance reviews, and asset management. The schema already includes the
  shared tables (departments, audit logs) they'll build on.

### Troubleshooting

- **`better-sqlite3` fails to install:** it ships prebuilt binaries for common
  platforms. If yours needs to compile from source, install build tools first
  (`build-essential` + `python3` on Linux, Xcode CLT on macOS, windows-build-tools
  on Windows), then re-run `npm install`.
- **Login works but data calls fail:** make sure the backend is running on port
  4000 — the Vite dev server proxies `/api` to it.
