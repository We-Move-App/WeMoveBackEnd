const UserModel = require("../../models/user-module/users/user.model");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");

const fetchLn = async (userId) => {
  try {
    if (!userId) return "en";

    const user = await UserModel.findById(userId).select("ln");

    return user?.ln || "en";
  } catch (err) {
    return "en";
  }
};

const fetchDriverLn = async (driverId) => {
  try {
    if (!driverId) return "en";

    const driver = await DriverBasicDetails.findById(driverId).select("ln");

    return driver?.ln || "en";
  } catch (err) {
    return "en";
  }
};

module.exports = { fetchLn, fetchDriverLn };
