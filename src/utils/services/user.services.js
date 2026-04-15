const UserModel = require("../../models/user-module/users/user.model");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");
const { AdminModel } = require("../../models/admin-module/admin/admin.model");
const {
  BusOperatorModel,
} = require("../../models/bus-module/bus-operator/bus-operator.model");
const {
  HotelManagerModel,
} = require("../../models/hotel-module/hotel-manager/hotel-manager.model");

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

const fetchAdminLn = async (adminId) => {
  try {
    if (!adminId) return "en";

    const admin = await AdminModel.findById(adminId).select("ln");

    return admin?.ln || "en";
  } catch (err) {
    return "en";
  }
};

const fetchBusOperatorLn = async (operatorId) => {
  try {
    if (!operatorId) return "en";

    const operator = await BusOperatorModel.findById(operatorId).select("ln");

    return operator?.ln || "en";
  } catch (err) {
    return "en";
  }
};

const fetchHotelManagerLn = async (hotelManagerId) => {
  try {
    if (!hotelManagerId) return "en";

    const hotelManager =
      await HotelManagerModel.findById(hotelManagerId).select("ln");

    return hotelManager?.ln || "en";
  } catch (err) {
    return "en";
  }
};

module.exports = {
  fetchLn,
  fetchDriverLn,
  fetchAdminLn,
  fetchBusOperatorLn,
  fetchHotelManagerLn,
};
