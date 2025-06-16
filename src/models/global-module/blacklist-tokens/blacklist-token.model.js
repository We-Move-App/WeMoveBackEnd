const mongoose = require("mongoose");

const BlacklistSchema = new mongoose.Schema({
  accessToken: { type: String, unique: true, sparse: true, required:true },
  refreshToken: { type: String, unique: true, sparse: true, required:true }, 
  createdAt: { type: Date, default: Date.now, expires: "1d" } 
});

const BlackListTokenModel = mongoose.model("BlacklistToken", BlacklistSchema);
module.exports = BlackListTokenModel;