# Test credentials

Single-user app (seeded by `cd /app/backend && python seed.py`):

- Email: athlete@ironcore.app
- Password: IronCore#2026

Login page also has a "Fill my account credentials" button (data-testid=login-demo-fill-button).
Auth = httpOnly cookie `ironcore_session` (JWT). Endpoints: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.

