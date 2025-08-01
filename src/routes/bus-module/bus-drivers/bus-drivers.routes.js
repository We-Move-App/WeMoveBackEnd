const express = require("express");
 
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");

const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");

const {
  getBusDrivers,
  registerBusDriver,
  assignDriverToBus,
  deleteDrivers,
  getDriverById,
  updateBusDriverDetails,
  unassignDriver
} = require("../../../controllers/bus-module/bus-drivers/bus-drivers.controllers");

const {
  sendOtpToBusDriver,
  verifyOtpBusDriverLogin,
  getBusDriverProfile,
} = require("../../../controllers/bus-module/bus-drivers/busDriverAuth");
const {isBusDriverAuthenticated} = require("../../../middlewares/authBusDrivers");

const{onboardUserByQR, getOnboardedUsersSummary} = require("../../../controllers/bus-module/bus-drivers/busDriversOnbaord");

const busDriverRoutes = express.Router();

busDriverRoutes.route("/sendbusdriverotp").post(sendOtpToBusDriver);
busDriverRoutes.route("/verifybusdriverotp").post(verifyOtpBusDriverLogin);
busDriverRoutes.route("/busdriverprofile").get( isBusDriverAuthenticated,getBusDriverProfile);
busDriverRoutes.route("/onboard-User").post( isBusDriverAuthenticated,onboardUserByQR);
busDriverRoutes.route("/onboarded-user").get(getOnboardedUsersSummary);


busDriverRoutes
  .route("/")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    getBusDrivers
  )
  .post(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    uploadDocuments,
    registerBusDriver
  );

busDriverRoutes
  .route("/assign-driver")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    assignDriverToBus
  );


busDriverRoutes
  .route("/:id")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    getDriverById
  )
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    uploadDocuments,
    updateBusDriverDetails
  )
  .delete(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    deleteDrivers
  );
  busDriverRoutes
  .route("/unassign/:id")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    unassignDriver
  );

 

module.exports = busDriverRoutes;
