# IronCore — Workout Tracker (living spec)

Personal (single-user) workout tracker. Dark gym UI, mobile-first, kg units.

## Stack
FastAPI + motor/Mongo (backend/), Vite React 19 TS + Tailwind v4 + shadcn base-ui (frontend/). All API under `/api`.
APP_TZ=Asia/Kolkata in backend/.env anchors "today" (split day, workout date).

## Auth
- Email + password, PBKDF2 hash, JWT (30d) in httpOnly cookie `ironcore_session` (secure, samesite=lax).
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. No signup (personal use) — account seeded.
- Credentials: see memory/test_credentials.md. Login page has "Fill my account credentials" button.

## Data model (Mongo collections, string uuid `id`)
- users {id, email, name, password_hash}
- exercises {id, name, muscle_group, equipment, is_custom, user_id?} — 68 built-ins (is_custom=false), custom ones per user
- templates {id, user_id, name, notes, exercises:[{exercise_id, exercise_name, muscle_group, target_sets, target_reps(str), rest_seconds}], created_at}
- splits {user_id, name, days:[{weekday 0=Mon..6, template_id|null(rest)}]}
- workouts {id, user_id, name, date YYYY-MM-DD, status active|completed, template_id, notes, started_at, finished_at, updated_at,
  exercises:[{uid, exercise_id, exercise_name, muscle_group, notes, rest_seconds, effort_mode rpe|rir,
  sets:[{uid, set_type W|N|D|F, weight, reps, rpe, rir, completed}]}]}

## Endpoints
- exercises: GET/POST /exercises, DELETE /exercises/{id} (custom only; 409 on duplicate name)
- templates: GET/POST /templates, PUT/DELETE /templates/{id}
- split: GET/PUT /split ; GET /today → today's weekday, template or rest, active_workout_id
- workouts: GET /workouts?limit (completed summaries), GET /workouts/active (or null), GET /workouts/previous?exercise_ids=a,b&exclude=id,
  POST /workouts {template_id?, name?} (409 if one active), GET/PUT/DELETE /workouts/{id}, POST /workouts/{id}/finish (drops incomplete sets, returns new PRs)
- analytics: GET /analytics/summary (weekly volume 12 wks, week streak, muscle workload 28 days, PRs), GET /analytics/exercise/{id} (e1RM/top weight points)

## Training math
- Working set = completed, not warm-up (W), reps > 0. Volume = Σ weight×reps of working sets.
- e1RM = Epley weight×(1+reps/30) (reps=1 → weight). RIR = 10 − RPE (picking one fills the other).
- PRs on finish: compared to prior completed workouts; only flagged if the exercise was done before.

## Key flows
- Dashboard: today's split day → Start template / Quick empty workout; resume bar if active.
- Logger (/workout/active, /workout/:id for editing completed): set rows (kg, reps, RPE|RIR select, big ✓), steppers ±2.5kg/±1 rep on next set,
  previous performance placeholders, set type menu (W/N/D/F/delete), rest timer auto-starts on ✓ (+30/−15/skip, chime), per-exercise notes & rest chip.
- Autosave: every edit → localStorage immediately + debounced PUT (700ms); offline → badge "Offline · stored locally", flushes on reconnect;
  refresh restores unsynced local draft (banner). Rest timer persists via absolute end time.
- Finish → confirm → result dialog (duration, volume, sets, PRs) → History.
- Templates CRUD + start; Split planner (7 selects, Rest or template); Exercise library search/filter + custom; Analytics charts + PR table.

## Seed (backend/seed.py, idempotent)
68 exercises; 6 templates (Push, Pull, Legs, Upper, Lower, Full Body); split Mon Push, Tue Pull, Wed Legs, Thu Rest, Fri Upper, Sat Lower, Sun Rest;
~20 completed workouts over the previous 28 days with +2.5kg/week progression.
