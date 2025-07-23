const express = require("express");
const errorHandler = require("./middlewares/errorHandler");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const { allowed_origin, node_env } = require("./config/config");
const helmet = require("helmet");
const logger = require("./utils/logger/logger");
const path = require("path");

// User Routes Path
const userAuthRoutes = require("./routes/user-module/user-auth/user-auth.routes");
const userRoutes = require("./routes/user-module/users/users.routes");
const UserAddressRoutes = require("./routes/user-module/user-address/user-address.routes");
const userBankRoutes = require("./routes/user-module/user-banks/user-banks.routes");
const userDocumentRoutes = require("./routes/user-module/user-documents/user-documents.routes");
const userSecurePinRoutes = require("./routes/user-module/user-secure-pin/user-secure-pin.routes");
const driverAuthRoutes = require("./routes/driver-module/driver-auth/driver-auth.routes");
const driverRoutes = require("./routes/driver-module/drivers/drivers.routes");
const driverSecurePinRoutes = require("./routes/driver-module/driver-secure-pin/driver-secure-pin.routes");
const driverDocumentRoutes = require("./routes/driver-module/driver-documents/driver-documents.routes");
const driverBankRoutes = require("./routes/driver-module/driver-banks/driver-banks.routes");
const userRecentSearchRoutes = require("./routes/user-module/user-recent-search/user-recent-search.routes");

const googleSearchRoutes = require("./routes/global-module/global-module/google-search.routes");
const driverVehicleRoutes = require("./routes/driver-module/driver-vehicle/driver-vehicle.route");
const userRidesBookingRoutes = require("./routes/user-module/user-rides/user-rides.routes");
const busOperatorAuthRoutes = require("./routes/bus-module/bus-operator-auth/bus-operator-auth.routes");
const busOperatorRoutes = require("./routes/bus-module/bus-operator-profile/bus-operator.routes");
const BusOperatorBankRoutes = require("./routes/bus-module/bus-operator-banks/bus-operator-banks.routes");
const busOperatorDocumentRoutes = require("./routes/bus-module/bus-operator-documents/bus-operator-documents.routes");
const busOperatorSecurityPinsRotues = require("./routes/bus-module/bus-operator-security-pins/bus-operator-security-pins.routes");
const BusesRoutes = require("./routes/bus-module/buses/buses.routes");
const busesRoutesRoutes = require("./routes/bus-module/buses-routes/buses-routes.routes");
const busImagesRoutes = require("./routes/bus-module/bus-images/bus-images.routes");
const busMemberRoutes = require("./routes/bus-module/bus-members/bus-members.routes");
const busFeedbackRoutes = require("./routes/bus-module/bus-feedbacks/bus-feedbacks.routes");
const busSeatLayoutRoutes = require("./routes/bus-module/bus-seats-layout/bus-seats.routes");
const userDigitalWalletRoutes = require("./routes/user-module/user-digital-wallet/user-digital-wallet.routes");
const userBusBookingsRoutes = require("./routes/user-module/user-bus-bookings/user-bus-bookings.routes");
const busOperatorBusBookings = require("./routes/bus-module/bus-bookings/bus-bookings.routes");
const hotelManagerAuthRoutes = require("./routes/hotel-module/hotel-manager-auth/hotelManagerAuth.routes");
const hotelManagerBankRoutes = require("./routes/hotel-module/hotel-manager-banks/hotel-manager-banks.routes");
const hotelImagesRoutes = require("./routes/hotel-module/hotel-images/hotel-images.routes");
const hotelDetailsRouter = require("./routes/hotel-module/hotel-registration/hotel-details.routes");
const verificationRoutes = require("./routes/global-module/global-module/verifications/verifications.routes");
const addressHotelRouter = require("./routes/hotel-module/hotel-registration/hotel-address.routes");
const hotelPolicyRouter = require("./routes/hotel-module/hotel-registration/hotel-policy.routes");
const {
  adminAuthRoutes,
} = require("./routes/admin-module/admin-auth/admin-auth.routes");
const {
  adminBusManagementRoutes,
} = require("./routes/admin-module/bus-operator/admin-bus-management.routes");
const {
  adminHotelManagementRoutes,
} = require("./routes/admin-module/hotel-management/admin-hotel-management.routes");
const {
  adminDriverManagementRoutes,
} = require("./routes/admin-module/drivers-management/admin-driver-management.routes");
const {
  adminUserManagementRoutes,
} = require("./routes/admin-module/user-management/admin-user-management.routes");
const userNotificationRoutes = require("./routes/user-module/user-notifications/user-notifications.routes");
const driverNotificationRoutes = require("./routes/driver-module/driver-notifications/driver-notifcations.routes");
const busOperatorNotificationRoutes = require("./routes/bus-module/bus-operator-notifications/bus-operator-notifications.routes");
const hotelNotificationRoutes = require("./routes/hotel-module/hote-notifications/hotel-notifications.routes");
const {
  adminPriceBreakRoutes,
} = require("./routes/admin-module/price-breakdown/price-breakdown.routes");
const {
  adminVehicleFareRoutes,
} = require("./routes/admin-module/vehicleFares/vehicleFares.routes");
const amenititesRoutes = require("./routes/global-module/Amenities/amenities.routes");
const RooomRouter = require("./routes/hotel-module/hotel-registration/hotel-room.routes");
const adminNotificationRoutes = require("./routes/admin-module/admin-notifications/admin-notifications.routes");
const hotelManagerRoutes = require("./routes/hotel-module/hotel-manager-profile/hotel-manager-profile.routes");
const busDriverRoutes = require("./routes/bus-module/bus-drivers/bus-drivers.routes");
const roomLayoutRoutes = require("./routes/hotel-module/room-layout/room-layout.routes");
const hotelFeedbackRoutes = require("./routes/hotel-module/hotel-feedback/hotel-feedback.routes");
const adminBranchesRoutes = require("./routes/admin-module/branches/branches.routes");
const hotelbookingRoutes = require("./routes/hotel-module/hotel-booking/hotel-booking.routes");
const busAnalyticsRoutes = require("./routes/bus-module/bus-analytics/bus-analytivs.routes");
const hotelManagerSecurityPinRoutes = require("./routes/hotel-module/hotel-manager-security-pin/hotel-manager-security-pin");
const hotelmanagerBookingRoutes = require("./routes/hotel-module/hotel-booking/hotel-manager-booking.routes");
const driverRidesRoutes = require("./routes/driver-module/driver-rides/driver-rides.routes");
const usersearchroutes = require("./routes/user-module/user-google-search/user-google-search.routes");
const newDriverauthRoute = require("./routes/new-driver-module/auth/auth.routes");
const UploadFileRouter = require("./routes/upload-files/upload-files.routes");
const driverBasicDetailsRouter = require("./routes/new-driver-module/basic-details/basic-details.routes");
const vehicleDetailsRoute = require("./routes/new-driver-module/vehicle-details/vehicle-details.routes");
const driverBankRoute = require("./routes/new-driver-module/bank-details/bank-details.routes");
const driverDocRouter = require("./routes/new-driver-module/documents/documents.routes");

if (node_env !== "production") {
  
  require("dotenv").config();
}

const allowedOrigins = allowed_origin;

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, origin);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
// app.options("*", (req, res) => {
//   const origin = req.headers.origin;
//   if (allowedOrigins.includes(origin)) {
//     res.setHeader("Access-Control-Allow-Origin", origin);
//     res.setHeader("Access-Control-Allow-Credentials", "true");
//     res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
//     res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
//     return res.status(200).json({});
//   }
//   res.status(403).json({ message: "CORS not allowed a" });
// });

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(helmet());

app.use(express.json());

app.use(express.static(path.join(__dirname, "src")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Received body ${req.body}`);
  next();
});

app.use("/test", (req, res) => {
  res.status(200).json({
    message: "Testing server for  Docker ,is working fine",
    status: "success",
    statusCode: 200,
  });
});

// User Routes
app.use("/api/v1/user/auth", userAuthRoutes);
app.use("/api/v1/user/", userRoutes);
app.use("/api/v1/user/address", UserAddressRoutes);
app.use("/api/v1/user/banks", userBankRoutes);
app.use("/api/v1/user/documents", userDocumentRoutes);
app.use("/api/v1/user/secure-pin", userSecurePinRoutes);
app.use("/api/v1/user/recent-searches", userRecentSearchRoutes);
app.use("/api/v1/user/user-Google-searches", usersearchroutes);
app.use("/api/v1/user/rides", userRidesBookingRoutes);
app.use("/api/v1/user/bus-bookings", userBusBookingsRoutes);
app.use("/api/v1/user/hotel-booking", hotelbookingRoutes);
app.use("/api/v1/user/wallet", userDigitalWalletRoutes);
app.use("/api/v1/user/notifications", userNotificationRoutes);

//Upload files to S3
app.use("/api/v1/file", UploadFileRouter);

// New Driver Routes
app.use("/api/v1/new-driver/auth", newDriverauthRoute);
app.use("/api/v1/driver", driverBasicDetailsRouter);
app.use("/api/v1/driver", vehicleDetailsRoute);
app.use("/api/v1/driver", driverBankRoute);
app.use("/api/v1/driver", driverDocRouter);

// Driver Routes
app.use("/api/v1/driver/auth", driverAuthRoutes);
app.use("/api/v1/drivers", driverRoutes);
app.use("/api/v1/driver/banks", driverBankRoutes);
app.use("/api/v1/driver/documents", driverDocumentRoutes);
app.use("/api/v1/driver/secure-pin", driverSecurePinRoutes);
app.use("/api/v1/driver/vehicle", driverVehicleRoutes);
app.use("/api/v1/driver/notifications", driverNotificationRoutes);
app.use("/api/v1/driver/rides", driverRidesRoutes);

// Bus Operator Routes
app.use("/api/v1/bus-management/auth", busOperatorAuthRoutes);
app.use("/api/v1/bus-operator", busOperatorRoutes);
app.use("/api/v1/bus-operator/banks", BusOperatorBankRoutes);
app.use("/api/v1/bus-operator/documents", busOperatorDocumentRoutes);
app.use("/api/v1/bus-operator/secure-pin", busOperatorSecurityPinsRotues);
app.use("/api/v1/bus-operator/buses", BusesRoutes);
app.use("/api/v1/buses/bus-routes", busesRoutesRoutes);
app.use("/api/v1/buses/drivers", busDriverRoutes);
app.use("/api/v1/buses/images", busImagesRoutes);
app.use("/api/v1/bus-operator/members", busMemberRoutes);
app.use("/api/v1/buses/feedback", busFeedbackRoutes);
app.use("/api/v1/buses/seat-layout", busSeatLayoutRoutes);
app.use("/api/v1/bus-operator/bookings", busOperatorBusBookings);
app.use("/api/v1/bus-operator/notifications", busOperatorNotificationRoutes);
app.use("/api/v1/bus-operator/analytics", busAnalyticsRoutes);

//Hotel-Routes
app.use("/api/v1/hotel-manager/auth", hotelManagerAuthRoutes);
app.use("/api/v1/hotel-manager/banks", hotelManagerBankRoutes);
app.use("/api/v1/hotel-manager/secure-pin", hotelManagerSecurityPinRoutes);
app.use("/api/v1/hotel", hotelDetailsRouter);
app.use("/api/v1/hotel-address", addressHotelRouter);
app.use("/api/v1/hotel-policies", hotelPolicyRouter);
app.use("/api/v1/hotel-images", hotelImagesRoutes);
app.use("/api/v1/hotel-room", RooomRouter);
app.use("/api/v1/hotel-manager/", hotelManagerRoutes);
app.use("/api/v1/room-layout", roomLayoutRoutes);
app.use("/api/v1/hotel-notifications", hotelNotificationRoutes);
app.use("/api/v1/hotel-feedback", hotelFeedbackRoutes);
app.use("/api/v1/hotelmanager-booking", hotelmanagerBookingRoutes);

// Admin Routes
app.use("/api/v1/admin/auth", adminAuthRoutes);
app.use("/api/v1/admin/user-management", adminUserManagementRoutes);
app.use("/api/v1/admin/driver-management", adminDriverManagementRoutes);
app.use("/api/v1/admin/bus-management", adminBusManagementRoutes);
app.use("/api/v1/admin/hotel-management", adminHotelManagementRoutes);
app.use("/api/v1/admin/notifications", adminNotificationRoutes);
app.use("/api/v1/admin/price-breakdown", adminPriceBreakRoutes);
app.use("/api/v1/admin/vehicle-fares", adminVehicleFareRoutes);
app.use("/api/v1/admin/branch", adminBranchesRoutes);

// Global Routes
app.use("/api/v1/google-search", googleSearchRoutes);
app.use("/api/v1/verification", verificationRoutes);
app.use("/api/v1/amenities", amenititesRoutes);

app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});
// app.use(cors)

app.use(errorHandler);
module.exports = app;
