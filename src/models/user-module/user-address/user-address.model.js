const mongoose = require("mongoose");

const userAddressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    required: true,
  },
});

const UserAddressModel = mongoose.model("UserAddress", userAddressSchema);

module.exports = { UserAddressModel };
