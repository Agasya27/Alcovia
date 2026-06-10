import { Router, type Request, type Response } from 'express';
import type { Operation } from '../types';
import {
  getNotificationLog,
  getStudentState,
  insertOperation,
  operationExists,
} from '../db/serverDb';
import { buildSeedState, STUDENT_ID } from '../db/seed';
import { processOperations } from '../sync/mergeEngine';

const router = Router();

// ─── POST /sync/push ───────────────────────────────────────────
router.post('/sync/push', async (req: Request, res: Response) => {
  try {
    const { studentId, operations } = req.body as {
      studentId?: string;
      deviceId?: string;
      operations?: Operation[];
    };
    const sid = studentId ?? STUDENT_ID;
    const ops = operations ?? [];

    let inserted = 0;
    for (const op of ops) {
      // Duplicate pushes (same op id) are ignored — idempotent ingestion.
      if (operationExists(op.id)) continue;
      insertOperation(op);
      inserted += 1;
    }

    await processOperations(sid);

    res.json({ ok: true, processedCount: inserted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /sync/state ───────────────────────────────────────────
router.get('/sync/state', (req: Request, res: Response) => {
  try {
    const studentId = (req.query.studentId as string) ?? STUDENT_ID;
    const state = getStudentState(studentId) ?? buildSeedState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /sync/n8n-log ─────────────────────────────────────────
router.get('/sync/n8n-log', (_req: Request, res: Response) => {
  try {
    res.json({ notifications: getNotificationLog() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /webhook-test ────────────────────────────────────────
// Mock notification sink that n8n calls. Simulates a WhatsApp delivery.
router.post('/webhook-test', (req: Request, res: Response) => {
  try {
    console.log(`[webhook-test] ${new Date().toISOString()}`, JSON.stringify(req.body));
    res.json({ received: true, at: Date.now() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
