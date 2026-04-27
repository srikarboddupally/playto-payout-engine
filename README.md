# Playto Payout Engine

International payments collected in USD. Indian merchants paid in INR.
This is the engine that sits in the middle.

🚀 **Live Deployment:** [playto-engine-frontend.vercel.app](https://playto-engine-frontend.vercel.app/)

---

## What this is

A payout service built for the specific failure modes of financial systems:
concurrent withdrawal requests, duplicate network retries, hung bank calls,
and partial failures mid-transaction.

Built with Django, Celery, PostgreSQL, and Redis. Deployed on Railway.

---

## The hard parts

**Money never stored as a float.**
Every amount lives as a `BigIntegerField` in paise. `9999` is always exactly
`9999`. Floating point arithmetic has no place near money.

**No balance column.**
Balance is derived at query time from an append-only ledger. Every rupee
that ever moved has a permanent record. The sum of that record is the balance.
Always. It cannot drift.

**Concurrent withdrawals handled at the database layer.**
Two simultaneous requests against the same balance. Exactly one succeeds.
PostgreSQL SERIALIZABLE isolation detects the conflict and aborts the second
transaction. A retry decorator catches the abort and re-evaluates with the
updated balance. Proved with a multi-threaded test.

**Idempotency enforced by a database constraint.**
Send the same `Idempotency-Key` twice. Get the same response twice. One
payout created. The guarantee lives at `UNIQUE(merchant_id, key)` in Postgres —
not in application-level if-exists checks.

**State machine with no escape hatches.**
`pending → processing → completed` or `pending → processing → failed`.
Nothing else. Enforced in a single `transition_to()` method that is the
only way to change payout status in the entire codebase.

**Full event trail.**
Every state transition creates an immutable `PayoutEvent`. The `PayoutEvent`
table is the truth. `current_status` on the `Payout` table is a read cache.

---

## Stack

| Layer | Technology |
|---|---|
| API | Django 5.2 + Django REST Framework |
| Database | PostgreSQL 16 |
| Background jobs | Celery 5.6 + Redis |
| Scheduler | Celery Beat |
| Deployment | Railway |
| Frontend | React + Vite, deployed on Vercel |

---

## Running locally

**Requirements:** Python 3.11+, PostgreSQL, Redis

```bash
git clone https://github.com/srikarboddupally/playtoEngine_backend
cd playtoEngine_backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env`:

```
SECRET_KEY=your-secret-key
DEBUG=True
DB_NAME=playto
DB_USER=playto_user
DB_PASSWORD=localdev
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://localhost:6379/0
```

```bash
python manage.py migrate
python manage.py seed
python manage.py runserver
```

In separate terminals:

```bash
celery -A config worker --loglevel=info -P solo
celery -A config beat --loglevel=info
```

---

## API

**Base URL:** `https://playtoenginebackend-production.up.railway.app`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/merchants/` | List all merchants |
| GET | `/api/v1/merchants/{id}/balance/` | Balance breakdown |
| GET | `/api/v1/merchants/{id}/ledger/` | Credit and debit history |
| GET | `/api/v1/merchants/{id}/payouts/` | Payout history with events |
| POST | `/api/v1/payouts/` | Request a payout |
| GET | `/api/v1/payouts/{id}/` | Payout detail with event trail |

**Creating a payout:**

```bash
curl -X POST https://playtoenginebackend-production.up.railway.app/api/v1/payouts/ \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(python3 -c 'import uuid; print(uuid.uuid4())')" \
  -d '{
    "merchant_id": "<uuid>",
    "amount_paise": 50000,
    "bank_account_id": "<uuid>"
  }'
```

Returns `201` on creation. Returns `200` with identical body on replay.
Returns `422` if balance is insufficient.

---

## Tests

```bash
python manage.py test merchants --verbosity=2
```

8 tests. Two matter most:

**Concurrency** — Two threads fire simultaneous 60-rupee requests against a
100-rupee balance. The test asserts exactly one success, one rejection, one
payout in the database, and a non-negative balance after.

**Idempotency** — Same key sent twice. Same payout ID in both responses. One
record in the database. Keys scoped per merchant. Expired keys allow reuse.

---

## Seed data

Three merchants seeded on every deploy:

| Merchant | Balance | State |
|---|---|---|
| Arjun Sharma | ₹13,500 | Clean — previous payout completed |
| Priya Nair | ₹16,000 total / ₹11,000 available | ₹5,000 held in pending payout |
| Karan Mehta | ₹12,000 | Failed payout — funds returned |

---

## Live

**API:** https://playtoenginebackend-production.up.railway.app

**Dashboard:** https://playto-engine-frontend.vercel.app

**Read the engineering decisions:** [EXPLAINER.md](./EXPLAINER.md)

---

## Architecture

```
React Dashboard (Vercel)
        │
        │  POST /api/v1/payouts/
        │  Idempotency-Key: <uuid>
        ▼
Django + DRF (Railway)
        │
        ├── SERIALIZABLE transaction
        │     ├── Idempotency check
        │     ├── Balance check (DB aggregation)
        │     └── Payout + PayoutEvent created
        │
        └── process_payout.delay()
                    │
                    ▼
            Redis Queue (Railway)
                    │
                    ▼
         Celery Worker (Railway)
              ├── pending → processing
              ├── simulate bank (70% success / 20% fail / 10% hang)
              ├── processing → completed → write debit ledger entry
              └── processing → failed → funds return automatically

Celery Beat (Railway) — every 60 seconds
    └── find payouts stuck in processing > 30s
        └── retry up to 3 times → then fail and return funds
```

---

Built for Playto's founding engineer challenge.