# EXPLAINER.md

This payout engine is designed assuming the application layer will crash, network will drop, and concurrent requests will collide. THe database(PostgreSQL) is the absolute, immutable source of truth.

## System Architecture

```
React Dashboard (Vercel)
    │
    │ HTTPS — Idempotency-Key header
    ▼
Django + DRF (Railway)
    │
    ├── SERIALIZABLE transaction
    │   ├── Idempotency check
    │   ├── Balance check (DB aggregation)
    │   └── Payout + Event creation
    │
    ├── process_payout.delay() ──────────────→ Redis Queue (Railway)
    │                                               │
    ▼                                               ▼
Postgres (Railway)                         Celery Worker (Railway)
├── merchants                              ├── transition → PROCESSING
├── ledger_entries (append-only)          ├── simulate_bank_settlement()
├── payouts (projection)                  ├── transition → COMPLETED/FAILED
├── payout_events (append-only)           └── write debit LedgerEntry
└── idempotency_keys                       (atomically with transition)

Celery Beat (Railway) — every 60s
└── retry_stuck_payouts()
    └── find PROCESSING payouts > 30s old
        └── requeue or move to FAILED
```

Two append-only streams are the source of truth: `ledger_entries` for money
movement and `payout_events` for payout lifecycle. Everything else is derived.

---

## 1. the ledger

**Query:**
```python
# merchants/models.py - Merchant.get_total_balance()
result = self.ledger_entries.aggregate(total=Sum('amount_paise'))
return result['total'] or 0
```

There is no 'balance' column on the 'Merchant' table. Balance does not exist as a stored number anywhere in the system; It's always derived at query time by summing the 'ledger_entries' table.

Credits are positive 'BigIntegerField' values in paise. Debits are negative. One 'SUM' query gives the balance directly. 
'BigIntegerField' maps to 'bigint' in POstgres. 9999 paise is always exactly 9999 paise.

I modelled it this way for two reasons:
    1. storing balance as a column creates a race condition under concurrency - two transactions read the same value and boht write back a decremented version, losing one update.
    2. a columns tells -> current number; ledger -> every rupee that ever moved and why.

Available balance is derived seperately:

```python
# merchants/models.py - Merchant.get_available_balance()
held = self.payouts.filter(current_status__in = ['pending','processing']).aggregate(total=Sum('amount_paise'))['total'] or 0
return self._get_total_balance() - held
```
Funds are never physically reserved. 
payout = ['pending'] or ['processing'] => counted as held
payout = ['failed'] => no longer counted. Funds automatically return.

## 2. the lock

**The exact code:**
```python
#merchants/services.py - _create_payout_inner()
with transaction.atomic():
    connection.cursor().execute(
        'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
    )
    merchant = Merchant.objects.get(id=merchant_id)
    # balance check, payout creation, idempotency key storage
    # all inside this single transaction
```

The database primitive is PostgreSQL Serializable Snapshot Isolation.

I chose this over 'select_for_update()' deliberately. 
'select_for_update()' is pessimistic. it locks on every read, causing all concurrent requests to queue up.

SSI is optimistic. Postgres tracks read and write sets across concurrent
transactions and detects conflicts at commit time.
If two reqs hit 'create_payout_inner()' simultaneously for the same merchant, both read same balance -> Both try to commit -> Postgres detects this overlap with each other's writes sets in a way that produces an anomaly if both committed. One commits; other gets a serialization failure with error code '40001'.

the retry decor catches '40001':
```python
# merchants/services.py — with_serializable_retry()
except OperationalError as e:
    if '40001' in str(e) or 'serialize' in str(e).lower():
        time.sleep(0.1 * (2 ** attempt))
        continue
    raise
```

on retry, the 2nd req reads the balance after the 1st one's committed. the first payout now exists and is counted as held -> checks Available balance -> if insufficient -> raises 'InsufficientFundsError'.

The concurrency test proves this works:

```
Serialization conflict on attempt 1, retrying in 0.1s
Successes: 1 — Rejections: 1 — Payout count in DB: 1
```

---
## 3. the idempotency

```python
# merchants/models.py — IdempotencyKey
class Meta:
    unique_together = [['merchant', 'key']]
```

```python
# merchants/services.py — get_valid_idempotency_key()
record = IdempotencyKey.objects.get(
    merchant=merchant,
    key=key,
    expires_at__gt=timezone.now()
)
```

The idempotency check runs inside the same `transaction.atomic()` block as the
payout creation. If it ran outside, two simultaneous requests with the same key
could both pass the check before either stored the key. Putting the check inside
the transaction means the `unique_together` constraint at the database level is
the final guarantee — not Python logic.

The exact JSON response from the first call is stored verbatim in
`response_body`. Second call returns this byte-for-byte. Not a similar response.
The same response. Keys are scoped per merchant and expire after 24 hours. I
use `update_or_create` so expired keys can be reused without hitting the unique
constraint.

**What idempotency does not protect against:**

Idempotency keys stop machines from making accidents — network retries, timeouts,
duplicate delivery from a message queue. They do not stop humans from making
accidents.

If a merchant clicks Withdraw, thinks it didn't work, refreshes the page, and
clicks again — the frontend generates a new UUID each time. The backend sees two
valid, distinct requests. Both succeed if balance allows.

Real protection against human accidents requires two additional layers I would
ship next:

**Layer 1 — Frontend debounce.** The Idempotency-Key UUID must be generated once
when the form mounts, not on each button click. The button disables immediately
on first click. This stops double-tap and impatient clicking.

**Layer 2 — Backend velocity check.** A business-logic guard before payout
creation:

```python
# Would live in merchants/services.py — _create_payout_inner()
recent = Payout.objects.filter(
    merchant=merchant,
    amount_paise=amount_paise,
    bank_account=bank_account,
    created_at__gte=timezone.now() - timedelta(minutes=5)
).exists()

if recent:
    raise DuplicatePayoutWarning(
        "Identical payout requested within 5 minutes. "
        "Send force=true to confirm."
    )
```

The frontend shows a confirmation modal. If the merchant confirms, the request
is resent with `force=true`. This is how Stripe handles it.

**Layer 3 — Grace period with cancellation.** Queue the Celery task with a
10-minute delay:

```python
process_payout.apply_async(args=[payout.id], countdown=600)
```

The merchant sees the payout as pending with a Cancel button. If it was an
accident, they cancel before the bank call ever happens. No money moves, no
fees incurred.

I did not ship layers 2 and 3 within the challenge window. I am documenting
them here because they represent the actual production gap between what I built
and what I would ship to real merchants.

---

## 4. the state machine

```python
# merchants/models.py — Payout.LEGAL_TRANSITIONS
LEGAL_TRANSITIONS = {
    'pending':    ['processing'],
    'processing': ['completed', 'failed'],
    'completed':  [],
    'failed':     [],
}

def transition_to(self, new_status, reason=None, metadata=None):
    if new_status not in self.LEGAL_TRANSITIONS[self.current_status]:
        raise InvalidTransitionError(
            f"Illegal: {self.current_status} → {new_status}"
        )
    PayoutEvent.objects.create(
        payout=self, event_type=new_status,
        metadata=metadata or {}, failure_reason=reason
    )
    self.current_status = new_status
```

`transition_to()` is the only way to change payout status in the entire codebase.
Direct assignment to `current_status` does not appear in service or task code.

Every transition creates an immutable `PayoutEvent` atomically with the status
update. The `PayoutEvent` table is the source of truth. `current_status` on the
`Payout` table is a read cache for fast dashboard queries. Both are updated in
the same `transaction.atomic()` block — they are always in sync.

`completed → failed` is blocked because `'failed'` is not in
`LEGAL_TRANSITIONS['completed']`. The list is empty. No transition out of a
terminal state is possible. When a payout fails, `transition_to('failed')` is
called, the event is written, and funds return automatically because the
balance calculation excludes terminal-state payouts.

---

## 5. The AI Audit

I used Claude throughout this build. It was useful for scaffolding and reasoning
through design decisions. It gave me wrong code in one specific place that would
have caused production incidents.

**What the AI gave me:**

```python
# AI-generated — do not ship
def create_payout(merchant_id, amount_paise, ...):
    merchant = Merchant.objects.get(id=merchant_id)

    existing = IdempotencyKey.objects.filter(
        merchant=merchant, key=idempotency_key
    ).first()
    if existing:
        return existing.response_body, False

    with transaction.atomic():
        balance = merchant.get_available_balance()
        if amount_paise > balance:
            raise InsufficientFundsError()
        payout = Payout.objects.create(...)
    return payout, True
```

**Two problems I caught:**

First: the idempotency check runs outside the transaction. Two concurrent requests
with the same key could both pass the check before either stores the key. The
`unique_together` constraint would catch the second one at the database level, but
by then the first payout is already created and queued. Depending on timing you
could have a duplicate in flight.

Second: the balance check runs at read-committed isolation by default. Between the
`get_available_balance()` read and the `Payout.objects.create()` write, another
transaction could commit a payout that consumes the available balance. The
check-then-act window is open. This is the classic time-of-check to time-of-use
race condition.

**What I replaced it with:**

```python
# merchants/services.py — _create_payout_inner()
with transaction.atomic():
    connection.cursor().execute(
        'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
    )
    merchant = Merchant.objects.get(id=merchant_id)

    # idempotency check inside the transaction
    existing = get_valid_idempotency_key(merchant, idempotency_key)
    if existing:
        return existing.response_body, False

    # balance check inside the same serializable transaction
    total = merchant.ledger_entries.aggregate(
        total=Sum('amount_paise')
    )['total'] or 0
    held = merchant.payouts.filter(
        current_status__in=['pending', 'processing']
    ).aggregate(total=Sum('amount_paise'))['total'] or 0

    if amount_paise > (total - held):
        raise InsufficientFundsError(...)

    payout = Payout.objects.create(...)
    store_idempotency_key(...)
```

Everything — idempotency check, balance read, payout creation, key storage — runs
inside a single SERIALIZABLE transaction. Postgres detects any concurrent
modification and raises a serialization failure. The retry decorator handles it.

The concurrency test confirms the fix works. Two threads firing simultaneously,
exactly one payout created, zero overdraft.