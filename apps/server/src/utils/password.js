import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password) {
  if (!password) return null;
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password, storedDigest) {
  if (!storedDigest) return true;
  if (!password) return false;

  const [salt, digestHex] = storedDigest.split(":");
  if (!salt || !digestHex) return false;

  const expected = Buffer.from(digestHex, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
