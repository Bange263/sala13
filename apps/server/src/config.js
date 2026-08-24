function integerFromEnv(name, fallback, minimum = 0) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = Object.freeze({
  host: process.env.HOST || "0.0.0.0",
  port: integerFromEnv("PORT", 3000, 1),
  environment: process.env.NODE_ENV || "development",
  allowedOrigins,
  disconnectGraceMs: integerFromEnv("DISCONNECT_GRACE_MS", 30_000),
  emptyRoomTtlMs: integerFromEnv("EMPTY_ROOM_TTL_MS", 30_000),
  staleRoomTtlMs: integerFromEnv("STALE_ROOM_TTL_MS", 6 * 60 * 60 * 1_000),
  socketRateWindowMs: integerFromEnv("SOCKET_RATE_WINDOW_MS", 10_000, 1_000),
  socketRateMaxEvents: integerFromEnv("SOCKET_RATE_MAX_EVENTS", 80, 10)
});

export function isOriginAllowed(origin, allowedOrigins = config.allowedOrigins) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}
