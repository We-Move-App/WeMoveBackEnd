const jwt = require("jsonwebtoken");
const UserModel = require("../models/user-module/users/user.model");
const DeviceTokensModel = require("../models/global-module/device-tokens/device-tokens.model");
const ApiError = require("../utils/response/ApiError");
const statusCode = require("../utils/constants/statusCode");
const { access_token_secret } = require("../config/config");

const authDeviceToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new ApiError(statusCode.UNAUTHORIZED, "Access token missing");
        }

        const token = authHeader.split(" ")[1];

        let decoded;
        try {
            decoded = jwt.verify(token, access_token_secret);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                throw new ApiError(statusCode.UNAUTHORIZED, "Token expired, please log in again");
            }
            throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
        }

        // ✅ Ensure token exists in device tokens collection
        const activeSession = await DeviceTokensModel.findOne({
            user: decoded.userId,
            token,
        });

        if (!activeSession) {
            throw new ApiError(
                statusCode.UNAUTHORIZED,
                "Session expired or logged in from another device"
            );
        }

        const user = await UserModel.findById(decoded.userId);
        if (!user) throw new ApiError(statusCode.NOT_FOUND, "User not found");

        req.user = user;
        req.sessionInfo = activeSession; // optional, for logging/debugging
        next();
    } catch (err) {
        next(
            new ApiError(
                statusCode.UNAUTHORIZED,
                err.message || "Invalid or expired token"
            )
        );
    }
};

module.exports = authDeviceToken;
