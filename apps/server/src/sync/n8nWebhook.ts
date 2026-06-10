import axios from 'axios';
import { hasNotificationBeenSent, recordNotification } from '../db/serverDb';

// Fires the n8n webhook for a confirmed successful session. The primary dedup
// lives inside n8n (keyed by sessionId); this server-side notification_log check
// is a second line of defence against the webhook being called twice.
export async function fireN8nWebhook(
  sessionId: string,
  studentId: string,
  streak: number,
  coinsEarned: number,
): Promise<void> {
  if (hasNotificationBeenSent(sessionId)) return;

  const webhookUrl =
    process.env.N8N_WEBHOOK_URL ?? 'http://localhost:5678/webhook/focus-session';

  await axios.post(webhookUrl, { sessionId, studentId, streak, coinsEarned });
  recordNotification(sessionId);
}
