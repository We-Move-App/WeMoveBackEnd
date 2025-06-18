// config/config.js
require("dotenv").config();

module.exports = {
  node_env: process.env.NODE_ENV || "development",
  allowed_origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim())
    : [],
};


