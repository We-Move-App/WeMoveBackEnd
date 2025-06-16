
const SecurePinModel = require("../../models/global-module/secure-pins/secure-pins.model");
const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const { securePinValidator } = require("../validation/forSchema");
const bcrypt = require("bcrypt");

const ValidateSecurePin = async ({ req, securePin }) => {

  let userId = req.user?._id
  
  if (!userId || !securePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "User Id and Secure Pin must be provided"
    );
  }

  if (securePin?.length !== 4 || !securePinValidator(securePin)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Secure pin should be a 4-digit number"
    );
  }

  const isSecurePinCorrect = await SecurePinModel.findOne({ userId });
  if (!isSecurePinCorrect) {
    throw new ApiError(statusCode.FORBIDDEN, "Secure PIN not set");
  }

  const isPinCorrect = await bcrypt.compare(
    securePin,
    isSecurePinCorrect.securePin
  );

  if (!isPinCorrect) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Incorrect secure pin");
  }

  return true;
};

module.exports = ValidateSecurePin;
