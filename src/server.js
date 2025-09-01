require("dotenv").config();
const app = require("./app");
const { port } = require("./config/config");
const connectDatabase = require("./config/database");
const logger = require("./utils/logger/logger");
const http = require("http");
const { initSuperAdmin } = require("./utils/services/SuperAdminInit");

const PORT = port || 8000;
const server = http.createServer(app);

// ✅ Setup socket.io server
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ Register socket namespaces
const { initializeSocket } = require("./socket");
initializeSocket(io);

// 🔄 Graceful shutdown handlers
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info("Server closed.");
      process.exit(0);
    });
  } else {
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

// 🚀 Start the server
const startServer = async () => {
  try {
    await connectDatabase();

    //SuperAmdin
    await initSuperAdmin();

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`✅ Server listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error(" Error starting server:", error);
    process.exit(1);
  }
};

startServer();
