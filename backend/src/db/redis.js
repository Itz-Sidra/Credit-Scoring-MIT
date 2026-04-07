import Redis from "ioredis";

const redisClient = new Redis({
  url: process.env.REDIS_URL,
  retryStrategy: (times) => {
    // Don't retry forever on initial connection failure
    // Just log errors but don't crash the server
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
