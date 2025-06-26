const mongoose = require("mongoose");
// mongoose.set('debug', true);
const { mongodb_url } = require("./config");
const logger = require("../utils/logger/logger");

const connectDatabase = async () => {
  return mongoose
    .connect(mongodb_url) // Return the promise from mongoose.connect
    .then((res) => {
      logger.info(`Connected to database successfully: ${res.connection.host}`);
    })
    .catch((err) => {
      logger.error("Error connecting to MongoDB", err);
      throw err; // Throw the error to propagate it
    });
};

module.exports = connectDatabase;

// const mongoose = require("mongoose");
// const { mongodb_url } = require("./config");
// const logger = require("../utils/logger/logger");

// const connectDatabase = async () => {
//   try {
//     mongoose.set("strictQuery", true);
//     const options = {
//       maxPoolSize: 10,
//       serverSelectionTimeoutMS: 5000,
//       socketTimeoutMS: 45000,
//     };

//     const connection = await mongoose.connect(mongodb_url, options);
//     logger.info(
//       `Connected to database successfully: ${connection.connection.host}`
//     );
//   } catch (error) {
//     logger.error("Error connecting to MongoDB", error);

//     // // Retry logic for transient errors
//     // setTimeout(() => {
//     //   logger.info("Retrying connection to MongoDB...");
//     //   connectDatabase();
//     // }, 5000); // Retry after 5 seconds
//   }

//   mongoose.connection.on("connected", () => {
//     logger.info("MongoDB connection established.");
//   });

//   mongoose.connection.on("error", (err) => {
//     logger.error("MongoDB connection error:", err);
//   });

//   mongoose.connection.on("disconnected", () => {
//     logger.warn("MongoDB connection lost. Reconnecting...");
//     connectDatabase();
//   });
// };

// module.exports = connectDatabase;
