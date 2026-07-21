import "server-only";

type RateLimitRecord = {
  timestamps: number[];
};

// In-memory store for tracking request timestamps per client key
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodically clean up expired records to prevent memory growth
if (typeof global !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      // Keep only timestamps within the last 15 minutes (max window)
      const validTimestamps = record.timestamps.filter((t) => now - t < 15 * 60 * 1000);
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      } else {
        record.timestamps = validTimestamps;
      }
    }
  }, 5 * 60 * 1000); // Run cleanup every 5 minutes
}

/**
 * Slide-window rate limiter in-memory.
 * 
 * NOTE FOR PRODUCTION:
 * This is an in-memory implementation suitable for development and single-instance deployments.
 * For serverless / multi-instance production environments (e.g., Vercel, multiple container nodes),
 * this should be replaced with a distributed store like Redis (e.g. Upstash Rate Limit) or database-backed tracking.
 * 
 * @param key Unique identifier for the client (e.g. IP address or User ID)
 * @param limit Maximum number of allowed requests within the window
 * @param windowMs Time window in milliseconds (e.g. 15 minutes = 15 * 60 * 1000)
 * @returns Boolean indicating whether the request is rate-limited (true = blocked)
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { timestamps: [] };

  // Filter out timestamps outside the current window
  const activeTimestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (activeTimestamps.length >= limit) {
    return true; // Rate limit exceeded
  }

  // Record this request
  activeTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: activeTimestamps });

  return false;
}
