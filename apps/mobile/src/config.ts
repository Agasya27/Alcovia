// Single hardcoded account shared by both simulated devices (no auth).
export const STUDENT_ID = 'student-001';

// Per-device identifier. Drives the IndexedDB namespace so two clients behave
// like two separate devices. Resolution order:
//   1. a `?device=` URL query param (lets one deployed URL act as two devices),
//   2. the EXPO_PUBLIC_CLIENT_ID baked at build time (used by the dev scripts),
//   3. fallback to 'device-1'.
function resolveDeviceId(): string {
  if (typeof window !== 'undefined' && window.location?.search) {
    const fromQuery = new URLSearchParams(window.location.search).get('device');
    if (fromQuery) return fromQuery;
  }
  return process.env.EXPO_PUBLIC_CLIENT_ID ?? 'device-1';
}

export const DEVICE_ID = resolveDeviceId();

// Base URL of the sync server.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Reward granted by the server for each successfully completed focus session.
export const COINS_PER_SESSION = 50;
