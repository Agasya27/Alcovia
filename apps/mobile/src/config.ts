// Single hardcoded account shared by both simulated devices (no auth).
export const STUDENT_ID = 'student-001';

// Per-device identifier. Drives the IndexedDB namespace so two browser tabs
// behave like two separate devices. Defaults to device-1.
export const DEVICE_ID = process.env.EXPO_PUBLIC_CLIENT_ID ?? 'device-1';

// Base URL of the sync server.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Reward granted by the server for each successfully completed focus session.
export const COINS_PER_SESSION = 50;
