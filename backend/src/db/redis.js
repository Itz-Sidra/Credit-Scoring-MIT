import Redis from "ioredis";

// ioredis ignores `{ url: ... }`; pass the URL (or host:port) as the first argument.
const redisConnection =
  process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";

const redisClient = new Redis(redisConnection, {
  retryStrategy: () => {
    // Don't retry forever on initial connection failure
    return null;
  },
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

redisClient.on("connect", () => {
  console.log("✓ Redis connected");
});

redisClient.on("error", (error) => {
  // Don't throw - just log the error
  // The server will use fallback OTP storage
  console.warn(
    "⚠ Redis connection error (fallback to in-memory storage):",
    error.message
  );
});

redisClient.on("close", () => {
  console.log("⚠ Redis connection closed");
});

export default redisClient;
