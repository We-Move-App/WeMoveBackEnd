const BusOperatorModel = require("../../models/bus-module/bus-operator/bus-operator.model");
const HotelManagerModel = require("../../models/hotel-module/hotel-manager/hotel-manager.model");
const UserModel = require("../../models/user-module/users/user.model");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");
const { AdminModel } = require("../../models/admin-module/admin/admin.model");

const resolveGeneratedId = async (entityType, entityId) => {
  if (!entityId) return "N/A";

  switch (entityType) {
    case "USER": {
      const user = await UserModel.findById(entityId).select("userId");
      return user?.userId || "N/A";
    }
    case "DRIVER": {
      const driver =
        await DriverBasicDetails.findById(entityId).select("driverId");
      return driver?.driverId || "N/A";
    }
    case "HOTEL": {
      const hotel =
        await HotelManagerModel.findById(entityId).select("managerId");
      return hotel?.managerId || "N/A";
    }
    case "BUS_OPERATOR": {
      const bus =
        await BusOperatorModel.findById(entityId).select("operatorId");
      return bus?.operatorId || "N/A";
    }
    case "ADMIN": {
      return "SYSTEM";
    }
    default:
      return "N/A";
  }
};

module.exports = {
  resolveGeneratedId,
};
