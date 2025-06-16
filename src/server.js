require("dotenv").config();
const app = require("./app");
const { port, node_env } = require("./config/config");
const connectDatabase = require("./config/database");
const os = require("os");
const cluster = require("cluster");
const PORT = port || 8000 || 8090;
// const { socketSetup } = require("./socket");
const{ handleSocketConnection }= require("./socket/socketHandler.new");
const path = require("path");
const http = require("http");
const logger = require("./utils/logger/logger");
const redis = require('./config/redisClient')

let server = http.createServer(app);


const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info("Server closed.");
      // await redis.quiet()
      process.exit(0);
    });
  } else {
    await shutdownServices();
    process.exit(0);
  }
};

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
  shutdown("unhandledRejection");
});


["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

// Start Server Function
const startServer = async () => {
  try {
    await connectDatabase();
    // logger.info("Database connected successfully.");

    // if (cluster.isMaster) {
    //   const numCPUs = os.cpus().length;
    //   logger.info(`Master process is running on PID: ${process.pid}`);

    //   // Fork workers for each CPU core
    //   for (let i = 0; i < numCPUs; i++) {
    //     cluster.fork();
    //   }

    //   cluster.on("exit", (worker, code, signal) => {
    //     logger.warn(`Worker ${worker.process.pid} died. Starting a new one...`);
    //     cluster.fork();
    //   });
    // } else {
    // Workers can share the same server port
    server = app.listen(PORT, () => {
      logger.info(`Worker ${process.pid} listening on port ${PORT}`);
    });
    // socketSetup(server);
    handleSocketConnection(server);
    // }
  } catch (error) {
    logger.error("Error starting server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
