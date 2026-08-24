export class SocketRateLimiter {
  constructor({ windowMs, maxEvents }) {
    this.windowMs = windowMs;
    this.maxEvents = maxEvents;
    this.buckets = new Map();
  }

  consume(socketId, now = Date.now()) {
    const current = this.buckets.get(socketId);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.buckets.set(socketId, { startedAt: now, count: 1 });
      return true;
    }

    current.count += 1;
    return current.count <= this.maxEvents;
  }

  delete(socketId) {
    this.buckets.delete(socketId);
  }
}
