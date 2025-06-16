const statusCode = require("../constants/statusCode");
const ApiResponse = require("../response/ApiResponse");

const saveDeviceToken = async (userId, token, deviceType, model) => {
  const existingToken = await model.findOne({ userId, token, deviceType });

  if (!existingToken) {
    const newToken = new model({ userId, token, deviceType });
    await newToken.save();
  }

  return new ApiResponse(statusCode.OK, {}, "Device token saved successfully");
};

const removeDeviceToken = async (userId, token, deviceType, model) => {
  const existingToken = await model.findOneAndDelete({
    userId,
    token,
    deviceType,
  });

  if (!existingToken) {
    return new ApiResponse(
      statusCode.OK,
      {},
      "Device token not found or already deleted"
    );
  }

  return new ApiResponse(
    statusCode.OK,
    {},
    "Device token deleted successfully"
  );
};

module.exports = { saveDeviceToken, removeDeviceToken };
