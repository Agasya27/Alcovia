# Decisions

## 1. Sync and data model

Every mutation a device makes is recorded as an immutable **operation** with a
stable UUID and a **Lamport clock** value. Operations are appended to a local
outbox (IndexedDB) and never edited after creation. There are four operation
types: `SESSION_COMPLETED`, `SESSION_FAILED`, `TASK_STATUS_CHANGED`,
`TASK_DELETED`.

- **The server is the single source of truth.** It ingests operations, processes
  them in Lamport-clock order, and rebuilds one canonical `StudentState`. Both
  devices pull that same state, so they converge.
- **Why Lamport clocks instead of wall-clock time:** device clocks disagree
  (clock skew, time zones, manual changes). A wall-clock "last write wins" would
  let a device with a fast clock silently stomp another's edits. A Lamport clock
  gives a consistent *causal* ordering that both devices and the server agree on,
  independent of physical time. Wall-clock timestamps (`createdAt`, `startedAt`)
  are kept for display only.
- **Why the server is authoritative for coins/streak/today's minutes:** these are
  derived rewards. Computing them only on the server (guarded by `reward_log`)
  prevents the same session from being counted twice when it is replayed or
  arrives from both devices. Clients show rewards optimistically for instant
  offline feedback; the server corrects them on the next pull.

### Storage

- Client: IndexedDB via `idb`, in a database namespaced per device
  (`alcovia-<deviceId>`) so two browser tabs behave like two real devices.
- Server: SQLite via `better-sqlite3` (synchronous), tables `operations`,
  `student_state`, `reward_log`, `notification_log`.

### Seed data uses fixed IDs (deliberate)

Subjects, chapters, and tasks are seeded with **deterministic, identical IDs on
both client and server** (e.g. `subject-math-ch1-t1`). This is required for
convergence: a `TASK_STATUS_CHANGED` operation references a `taskId`, and that ID
must mean the same task everywhere. Random per-device UUIDs would never reconcile.
The single account is hardcoded as `studentId = "student-001"`; the value in
`EXPO_PUBLIC_CLIENT_ID` is the *device* id, used only for the storage namespace
and the `deviceId` stamped on operations.

## 2. Why two devices always converge

1. Each operation has a **stable UUID**. The server's `operations` table uses that
   UUID as its PRIMARY KEY, so a duplicate push (retry, or the same op arriving
   from both devices) is ignored — `INSERT OR IGNORE`.
2. The server processes operations **in Lamport order** and applies the same
   deterministic merge rules every time, rebuilding the canonical state.
3. Both devices **pull the identical canonical state** and run the same client-side
   reconcile, which is a deterministic function of (local state, server state).

Because ingestion is idempotent, processing is deterministic and order-stable, and
both clients read from the same canonical state, the devices end in identical
state regardless of the order or number of times operations arrive.

## 3. Conflict resolution

**a. Same task changed on both devices** (e.g. phone -> Done, laptop -> In progress):
highest Lamport clock wins (last-write-wins by causality, not wall-clock). On an
exact clock tie the server's value is chosen — a deterministic tiebreak, and since
both devices reconcile against the same server state they still converge. (A
finer-grained tiebreak by larger operation id is also possible; server-wins is
simpler and sufficient here.)

**b. Task edited on one device, deleted on the other:** the **tombstone wins**. A
delete sets `deletedAt` and propagates permanently; once a task is deleted it stays
deleted, beating any concurrent or later status edit. There is no "undelete"
operation, so this rule is stable and convergent.

**c. Same sync message arriving twice, or out of order:** the `operations` PRIMARY
KEY drops duplicates, and processing is ordered by Lamport clock, so out-of-order
or replayed messages produce the same result.

## 4. Idempotency (three layers)

1. **Backend rewards:** `reward_log` is keyed by `sessionId`. Coins, streak, and
   today's minutes for a session are applied **exactly once**, no matter how many
   times `SESSION_COMPLETED` arrives or is replayed.
2. **n8n workflow:** the `Check Dedup` Code node stores seen `sessionId`s in
   `getWorkflowStaticData('global')`. A second execution for the same session
   returns `[]` and no notification is sent.
3. **Belt-and-suspenders:** before calling the webhook, the server also checks
   `notification_log` (keyed by `sessionId`), guarding against a race where the
   webhook could be invoked twice on the server side.

Together these guarantee the WhatsApp/mock notification fires **exactly once per
successful session**, even when that session syncs from both devices.

## 5. One tradeoff

We chose **server-authoritative rewards with optimistic client display**. The
client increments coins/streak immediately for a good offline experience, and the
server corrects the values on the next pull. The tradeoff: if sync is delayed, a
device can briefly show inflated coins/streak (for example, both devices each show
+1 streak offline, but after sync the canonical streak is correct). We accepted
this temporary, self-healing inconsistency because the alternative — hiding rewards
until the server confirms — would break offline UX entirely, which is the whole
point of the app.

## Where it could still break

- Streak math uses the **server's** wall-clock day boundary; a session completed
  just before midnight on a device in another time zone could land on a different
  day than the student expects.
- n8n dedup relies on `getWorkflowStaticData` persistence; if the n8n instance is
  reset, its dedup memory is lost (the server's `notification_log` still guards
  against re-firing for sessions it already processed).
- The design is tested for **two** devices. Three or more should work by the same
  argument, but it is not exercised here.
- Pull sends the **full** state, not a delta — fine at this scale, not efficient
  for large syllabi.
