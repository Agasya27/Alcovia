# Demo Checklist

End-to-end verification of offline-first sync, idempotent rewards, and the
exactly-once n8n notification.

## 1. Start everything

- [ ] `npm run install:all` (first time only)
- [ ] Terminal 1: `npm run dev:server` -> server on http://localhost:3000
- [ ] Terminal 2: `npm run dev:client1` -> open http://localhost:8081
- [ ] Terminal 3: `npm run dev:client2` -> open http://localhost:8082
- [ ] Start n8n: `npx n8n`, import `n8n-workflow.json`, **activate** it
- [ ] Confirm `N8N_WEBHOOK_URL` in `apps/server/.env`, restart the server if changed

## 2. Verify baseline

- [ ] Device 1 header shows "device-1"; Device 2 shows "device-2"
- [ ] Both show the Online pill
- [ ] Both show the same starting coins/streak (0)
- [ ] Syllabus shows the same subjects/chapters/tasks on both

## 3. Offline focus session on both devices

- [ ] Device 1: Dev Panel -> toggle **OFFLINE**
- [ ] Device 1: Focus tab -> start a session -> **Complete** when the timer
      reaches target (or **Give Up** to record a failed attempt)
- [ ] Device 2: Dev Panel -> toggle **OFFLINE**
- [ ] Device 2: start a session -> **Complete** it
- [ ] Both Dev Panels: **Refresh Outbox** shows pending operations
- [ ] Both Dev Panels: optimistic coins differ from the server's value

## 4. Conflicting task edit (still offline)

- [ ] Device 1: Mathematics -> Algebra Basics -> Task 1 -> tap status to **Done**
- [ ] Device 2: same task -> tap status to **In progress**
- [ ] Dev Panels show the task in different states on each device

## 5. Reconnect and reconcile

- [ ] Device 1: Dev Panel -> toggle **ONLINE** -> **Sync Now**
- [ ] Device 2: Dev Panel -> toggle **ONLINE** -> **Sync Now**
- [ ] Wait ~5s and press **Sync Now** again on both
- [ ] Expected: identical state on both (same coins, streak, today's minutes)
- [ ] Expected: the task conflict resolved the same way on both (highest Lamport
      clock wins)

## 6. Verify n8n fired exactly once

- [ ] Dev Panel -> **Check Server**: `notification_log` shows exactly one entry per
      successful session
- [ ] n8n execution log: one successful run; the replay stops at **Check Dedup**
- [ ] Server terminal: exactly one `POST /webhook-test` per successful session

## 7. Streak correctness

- [ ] Streak incremented correctly even though both devices optimistically bumped
      it offline and both synced (no double counting)

---

Note any failure with the exact error and which area it points to (client store,
sync engine, server merge engine, routes, or n8n workflow).
