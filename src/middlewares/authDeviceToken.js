const BlackListTokenModel = require("../models/global-module/blacklist-tokens/blacklist-token.model");
const statusCode = require("../utils/constants/statusCode");
const logger = require("../utils/logger/logger");
const ApiError = require("../utils/response/ApiError");
const catchAsyncError = require("../utils/response/catchAsyncError");
const jwt = require("jsonwebtoken");
const DeviceTokensModel = require("../models/global-module/device-tokens/device-tokens.model");
const UserModel = require("../models/user-module/users/user.model");
const { access_token_secret } = require("../config/config");
const hashToken = require("../utils/hashToken/hashToken");
const UserDeviceTokenModel = require("../models/user-module/user-device-tokens/user-device-tokens.model");

const authDeviceToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new ApiError(statusCode.UNAUTHORIZED, "Access token missing");
        }

        const token = authHeader.split(" ")[1];

        // Decode/verify token using your utility (this will throw if invalid/expired)
        let decoded;
        try {
            decoded =

                jwt.verify(token, access_token_secret);
            // use your existing util so payload shape is consistent
        } catch (err) {
            // decodeAccessToken should throw appropriate ApiError or Error
            throw new ApiError(statusCode.UNAUTHORIZED, err.message || "Invalid or expired token");
        }

        // Determine user id from decoded payload (your payload uses _id)
        const userId = decoded?._id || decoded?.userId;
        if (!userId) throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token payload");

        // Hash incoming token and check in device tokens collection

        const tokenHash = hashToken(token);
        const session = await UserDeviceTokenModel.findOne({
            userId: userId, // Correct, userId is string or ObjectId already
            token: tokenHash,
        });

        console.log("Session found in authDeviceToken middleware:", session);

        if (!session) {
            throw new ApiError(
                statusCode.UNAUTHORIZED,
                "Session expired or logged in from another device"
            );
        }

        // Optional: load user and attach to req
        const user = await UserModel.findById(userId);
        if (!user) throw new ApiError(statusCode.NOT_FOUND, "User not found");

        req.user = user;
        req.sessionInfo = session;
        next();
    } catch (err) {
        // pass ApiError to your global handler
        next(new ApiError(statusCode.UNAUTHORIZED, err.message || "Invalid or expired token"));
    }
};

module.exports = authDeviceToken;
