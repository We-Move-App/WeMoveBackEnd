const { createClient } = require("redis");
const { redis_host, redis_port } = require("./config");
const logger = require("../utils/logger/logger");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("connect", () => logger.info(" Redis Connected"));
redisClient.on("ready", () => logger.info(" Redis Ready"));
redisClient.on("error", (err) => logger.error(" Redis Error:", err));
redisClient.on("end", () => logger.warn(" Redis Disconnected"));

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    logger.error(" Redis Connection Error:", error);
  }
};

module.exports = { connectRedis, redisClient };
