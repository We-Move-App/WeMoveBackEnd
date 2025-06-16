// const { createClient } = require("redis");
// const {
//   redis_host,
//   redis_password,
//   redis_port,
//   redis_username,
// } = require("./config");
// const logger = require("../utils/logger/logger");

// const redisConfig = {
//   username: redis_username,
//   password: redis_password,
//   socket: {
//     host: redis_host,
//     port: redis_port,
//   },
// };

// // Create Redis Client
// const redisClient = createClient(redisConfig);

// // Handle Redis Errors
// redisClient.on("error", (err) => console.error("Redis Client Error:", err));

// // Function to connect to Redis
// const connectRedis = async () => {
//   try {
//     if (!redisClient.isOpen) {
//       await redisClient.connect();
//       logger.info("Connected to Redis");
//     }
//   } catch (error) {
//     logger.error("❌ Redis Connection Error:", error);
//   }
// };

// module.exports = { connectRedis, redisClient };


// ===============================================================
// const Redis = require("ioredis");
// const logger = require("../utils/logger/logger");
// const { redis_host, redis_port, redis_password } = require("./config");

// // Create a Redis client with environment variables
// const redis = new Redis({
//   host: redis_host || "127.0.0.1", 
//   port: redis_port || 6379,
//   password: redis_password || undefined, 
//   db: process.env.REDIS_DB || 0, 
  // retryStrategy: (times) => {
  //   logger.warn(`Redis reconnect attempt #${times}`);
  //   return Math.min(times * 200, 5000); // Exponential backoff (max 5 seconds)
  // },
  // reconnectOnError: (err) => {
  //   logger.error("Redis Connection Error:", err.message);
  //   return err.message.includes("ECONNRESET") || err.message.includes("ETIMEDOUT");
  // },
// });

// // Logging connection status
// redis.on("connect", () => {
//   logger.info("Connected to Redis Server successfully");
// });

// redis.on("error", (err) => {
//   logger.error("Error connecting to Redis Server:", err);
// });

// redis.on("reconnecting", (time) => {
//   logger.warn(`Reconnecting to Redis in ${time} ms`);
// });

// redis.on("end", () => {
//   logger.warn("Redis connection closed");
// });


// module.exports = redis;
