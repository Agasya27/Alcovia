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

## Deployment (optional)

The app has three parts with different hosting needs. A working setup:

### Backend → Railway (Express + SQLite)
1. New project → Deploy from this GitHub repo.
2. Set the service **Root Directory** to `apps/server` (Settings → Source).
3. Add a **Volume** mounted at `/data` (Settings → Volumes) so SQLite persists.
4. Set environment variables (Settings → Variables):
   - `SQLITE_PATH=/data/alcovia.sqlite`
   - `N8N_WEBHOOK_URL=<your n8n production webhook URL>`
   - (`PORT` is provided by Railway automatically.)
5. Railway uses `apps/server/railway.json`: it runs `npm run build` (compiles TypeScript) then `npm run start` (`node dist/index.js`). Note your public URL, e.g. `https://alcovia-api.up.railway.app`.

### Frontend → Vercel (Expo web export)
1. New project → import this repo.
2. Set the project **Root Directory** to `apps/mobile`.
3. Vercel uses `apps/mobile/vercel.json` (build `npx expo export --platform web`, output `dist`, SPA rewrite).
4. Add environment variable:
   - `EXPO_PUBLIC_API_URL=<your Railway backend URL>`
5. Deploy. Open the resulting URL.

### n8n → n8n Cloud
With the backend public, n8n Cloud can both receive the webhook and call back to the backend's `/webhook-test` sink. Import `n8n-workflow.json`, change the `Send Notification` URL to `<backend URL>/webhook-test`, publish, and set `N8N_WEBHOOK_URL` on the backend to the cloud webhook URL.

### Simulating two devices on a deployed URL
Two tabs in the same browser share storage. On a single deployed URL, open it in **two different browsers** (or a normal + incognito window), or use the `?device=` query param to give each its own storage namespace:
- `https://your-app.vercel.app/?device=device-1`
- `https://your-app.vercel.app/?device=device-2`

> Note on SQLite: persistence requires the Railway volume above. Without a volume the database resets on redeploy. For a production system you would migrate to Postgres; SQLite with a persistent disk is sufficient here.

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
