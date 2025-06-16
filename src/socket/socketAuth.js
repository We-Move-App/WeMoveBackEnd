// const jwt = require("jsonwebtoken");
// const { access_token_secret } = require("../config/config");
// const ApiError = require("../utils/response/ApiError");
// const statusCode = require("../utils/constants/statusCode");
// const { TypeOfUser } = require("../utils/constants/constants");
// const HotelManagerModel = require("../models/hotel-module/hotel-manager/hotel-manager.model");
// const UserModel = require("../models/user-module/users/user.model");
// const DriverModel = require("../models/driver-module/drivers/drivers.model");
// const BusOperatorModel = require("../models/bus-module/bus-operator/bus-operator.model");

// Import required modules
const jwt = require("jsonwebtoken");
const { access_token_secret } = require("../config/config"); // Secret key for verifying JWT
const ApiError = require("../utils/response/ApiError"); // Custom error handling utility
const statusCode = require("../utils/constants/statusCode"); // Predefined HTTP status codes
const { TypeOfUser } = require("../utils/constants/constants"); // Enum for different user roles

// Importing user models based on different roles
const HotelManagerModel = require("../models/hotel-module/hotel-manager/hotel-manager.model");
const UserModel = require("../models/user-module/users/user.model");
const DriverModel = require("../models/driver-module/drivers/drivers.model");
const BusOperatorModel = require("../models/bus-module/bus-operator/bus-operator.model");

/**
 * Utility function to return the correct Mongoose model
 * based on the userType from the token payload
 */
const getModelByUserType = (userType) => {
  switch (userType) {
    case TypeOfUser.USER:
      return UserModel;
    case TypeOfUser.DRIVER:
      return DriverModel;
    case TypeOfUser.BUSOPERATOR:
      return BusOperatorModel;
    case TypeOfUser.HOTELMANAGER:
      return HotelManagerModel;
    default:
      return null;
  }
};

/**
 * Middleware function for Socket.IO authentication
 * Verifies the token sent by the client and attaches the user info to the socket object
 */
const socketAuth = async (socket, next) => {
  try {
    // Try to extract the token from different possible locations
    const token =
      socket.handshake.auth?.token || // Case 1: Passed in handshake auth
      socket.handshake.headers?.authorization?.split(" ")[1] || // Case 2: From 'Authorization' header (e.g., "Bearer <token>")
      socket.handshake.query?.token; // Case 3: Sent as query param

    // If no token is found, throw an unauthorized error
    if (!token) {
      throw new ApiError(statusCode.UNAUTHORIZED, "No token provided");
    }

    // Ensure the JWT secret exists in the config
    if (!access_token_secret) {
      throw new ApiError(statusCode.NOT_FOUND, "JWT Secret missing");
    }

    // Decode and verify the JWT token
    const payload = jwt.verify(token, access_token_secret);
    const { _id, userType } = payload;

    // Get the correct user model based on userType
    const Model = getModelByUserType(userType);
    if (!Model) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid user type");
    }

    // Look up the user by ID from the corresponding model
    const user = await Model.findById(_id).select("role _id verificationStatus");

    // If user not found in the database
    if (!user) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }

    // Attach essential user info to the socket object
    socket.user = {
      id: _id,
      role: user.role,
      userType,
    };

    // Allow the socket connection to proceed
    next();
  } catch (error) {
    console.log("Socket Authentication Error:", error);

    // Handle all token or user validation errors
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }
};

// Export the middleware so it can be used in socket server setup
module.exports = socketAuth;


// const getModelByUserType = (userType) => {
//   switch (userType) {
//     case TypeOfUser.USER:
//       return UserModel;
//     case TypeOfUser.DRIVER:
//       return DriverModel;
//     case TypeOfUser.BUSOPERATOR:
//       return BusOperatorModel;
//     case TypeOfUser.HOTELMANAGER:
//       return HotelManagerModel;
//     default:
//       return null;
//   }
// };

// const socketAuth = async (socket, next) => {
//   try {
//     const token =
//       socket.handshake.auth?.token ||
//       socket.handshake.headers?.authorization?.split(" ")[1] ||
//       socket.handshake.query?.token;

//     if (!token) {
//       throw new ApiError(statusCode.UNAUTHORIZED, "No token provided");
//     }

//     if (!access_token_secret) {
//       throw new ApiError(statusCode.NOT_FOUND, "JWT Secret missing");
//     }

//     // Decode the token
//     const payload = jwt.verify(token, access_token_secret);
//     const { _id, userType } = payload;

//     // Determine the model based on userType
//     const Model = getModelByUserType(userType);
//     if (!Model) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Invalid user type");
//     }

//     // Fetch the user from the correct model
//     const user = await Model.findById(_id).select(
//       "role _id verificationStatus"
//     );

//     if (!user) {
//       throw new ApiError(statusCode.NOT_FOUND, "User not found");
//     }

//     // Attach user info to socket
//     socket.user = { id: _id, role: user.role, userType };

//     next();
//   } catch (error) {
//     console.log("Socket Authentication Error:", error);
//     throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
//   }
// };

// module.exports = socketAuth;
