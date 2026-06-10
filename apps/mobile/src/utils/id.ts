import * as Crypto from 'expo-crypto';

// Works on web and native. Browser builds resolve to the platform crypto;
// native (Hermes) lacks a global crypto, so we go through expo-crypto.
export function randomUUID(): string {
  return Crypto.randomUUID();
}
