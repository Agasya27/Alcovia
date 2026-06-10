# Alcovia — Offline-First Study App

An offline-first study app with two features — **Focus Sessions** and **Syllabus
Progress** — a sync backend, and an n8n automation. Two devices on the same
account can go offline, diverge, and reconcile to identical state. Rewards are
counted exactly once, and the n8n notification fires exactly once per successful
session.

**Stack:** TypeScript · React Native (Expo, web target) · Express · SQLite · n8n
**Sync model:** operation log with Lamport clocks; the server is the single source
of truth. See [DECISIONS.md](DECISIONS.md).

## Project layout

```
apps/
  mobile/   Expo (React Native web) client — IndexedDB, Zustand, sync engine
  server/   Express API — SQLite, merge engine, n8n webhook
n8n-workflow.json   importable n8n workflow
DECISIONS.md        data/sync model, conflict resolution, idempotency, tradeoff
DEMO_CHECKLIST.md   step-by-step demo script
```

## Prerequisites

- Node.js 18+ (developed on Node 24)
- npm

## Quick start (3 steps)

1. **Install dependencies** (everything is installed locally inside this folder):

   ```bash
   npm run install:all
   ```

2. **Run the server** (terminal 1):

   ```bash
   npm run dev:server
   ```

   Serves on `http://localhost:3000`. It creates `apps/server/alcovia.sqlite` and
   seeds the default account on first run.

3. **Run the two clients** (terminals 2 and 3):

   ```bash
   npm run dev:client1   # device-1 -> http://localhost:8081
   npm run dev:client2   # device-2 -> http://localhost:8082
   ```

## Running two devices

Open `http://localhost:8081` and `http://localhost:8082`. Each client uses an
IndexedDB database namespaced by its device id (`alcovia-device-1` /
`alcovia-device-2`), so the two tabs behave like two separate devices even though
they share one `studentId` (`student-001`). The header shows which device you are
on, and a status pill shows online/offline.

> Tip: if the two tabs ever appear to share state, confirm they are on different
> ports (8081 vs 8082) — the namespace is derived from `EXPO_PUBLIC_CLIENT_ID`,
> which the dev scripts set per client.

## Importing the n8n workflow

1. Start n8n: `npx n8n` (opens `http://localhost:5678`).
2. In n8n: **Workflows -> Import from File -> `n8n-workflow.json`**.
3. **Activate** the workflow. Its webhook is `POST /webhook/focus-session`.
4. Point the server at it. In `apps/server/.env`:

   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/focus-session
   ```

   (For n8n Cloud, use the production webhook URL shown on the Webhook node.)

The workflow: **Webhook -> Check Dedup (static-data dedup by sessionId) -> Send
Notification (POST to the server's `/webhook-test` mock sink) -> Respond OK.**

## Demo script

1. Start the server, both clients, and n8n (with the workflow active).
2. On **both** devices: open the **Dev Panel** tab and toggle to **OFFLINE**.
3. **Device 1:** start a focus session; either wait for the timer and **Complete**,
   or use **Give Up** to record a failed attempt.
4. **Device 2:** start a focus session and **Complete** it (for a short demo, pick
   25m and use the Dev Panel only after it is completable, or just complete on
   device 1; the timer must reach the target to complete).
5. **Conflicting task edit (still offline):** Device 1 sets *Mathematics ->
   Algebra Basics -> Task 1* to **Done**; Device 2 sets the **same task** to **In
   progress**.
6. Confirm in each Dev Panel: **Pending Operations** outbox is non-empty and the
   two devices show different state.
7. Toggle both devices back to **ONLINE** and press **Sync Now** on each (wait ~5s
   and sync again). Both converge to **identical** state: same coins, streak,
   today's minutes, and the same resolved task status (highest Lamport clock wins).
8. **n8n fired exactly once:** Dev Panel -> **Check Server** shows one entry per
   successful session in `notification_log`; the n8n execution log shows the second
   run stopping at *Check Dedup*; the server logs show exactly one `POST
   /webhook-test`.

A full checklist is in [DEMO_CHECKLIST.md](DEMO_CHECKLIST.md).

## Conflict cases handled

- **Same task changed on both devices** — highest Lamport clock wins (causal LWW);
  server breaks an exact tie deterministically.
- **Task edited on one device, deleted on the other** — the tombstone wins; the
  deletion propagates permanently.
- **Duplicate / out-of-order sync messages** — ignored via the `operations`
  primary key; processing is ordered by Lamport clock and is idempotent.

## What's left out / next steps

- Real authentication (single hardcoded `studentId`).
- Three-or-more device support (designed for it; only two are exercised).
- Efficient delta sync (pull currently returns the full state).
- Surfacing a conflict to the user when an automatic merge isn't obviously right.
- Property/fuzz tests over random offline edit sequences.
- Real WhatsApp delivery (the n8n workflow posts to a mock sink; swap in a real
  provider node to send actual messages).
