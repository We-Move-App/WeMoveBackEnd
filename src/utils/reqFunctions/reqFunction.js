const { rolesTypes } = require("../constants/constants");
const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const moment = require("moment");

const formatDistanceTime = (data) => {
  return {
    distance: (data.distance.value / 1000).toFixed(1),
    duration: data.duration.text.replace("hours", "h").replace("mins", "min"),
  };
};

const validateRequestBody = (requiredFields, reqBody) => {
  const missingFields = requiredFields.filter((field) => !reqBody[field]);

  if (missingFields.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Missing required fields: ${missingFields.join(", ")}`
    );
  }
};

const normalizeDate = (dateInput) => {
  let mDate = moment.utc(dateInput, "YYYY-MM-DD", true); // Force UTC

  if (!mDate.isValid()) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid date input");
  }

  return mDate.startOf("day").toDate();
};

const getTodayNormalized = () => {
  return moment.utc().startOf("day").toDate();
};

const logNormalizedDate = (dateInput) => {
  const normalizedDate = normalizeDate(dateInput).toISOString();
  return normalizedDate;
};

// const normalizeDate = (dateInput) => {
//   let mDate = moment(dateInput, ["YYYY-MM-DD", moment.ISO_8601], true);

//   if (!mDate.isValid()) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Invalid date input");
//   }

//   // Format as "YYYY-MM-DD" string to remove time component
//   return mDate.format("YYYY-MM-DD");
// };

// const getTodayNormalized = () => {
//   return moment().format("YYYY-MM-DD");
// };

const isValidFutureDate = (dateInput) => {
  let mDate = moment(dateInput, "YYYY-MM-DD", true);

  if (!mDate.isValid()) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid date format. Use YYYY-MM-DD."
    );
  }

  // Get today's date without time
  const today = moment().startOf("day");

  if (mDate.isBefore(today)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Date cannot be in the past.");
  }

  return true;
};

const validateMongooseId = (id) => {
  if (!id) {
    throw new ApiError(statusCode.BAD_REQUEST, "Provide a valid id");
  }
  const result = mongoose.Types.ObjectId.isValid(id);

  return result;
};

const validateRole = (role) => {
  if (!rolesTypes.includes(role)) {
    throw new ApiError(
      400,
      `Invalid role. Available roles are: ${rolesTypes.join(", ")}`
    );
  }
};

const checkBusOperatorAuthority = (req, requiredAuthority) => {
  if (req.user?.role === "bus-operator-member") {
    if (
      !req.user.authorities?.busOperatorAuthorities.includes(requiredAuthority)
    ) {
      throw new ApiError(
        statusCode.FORBIDDEN,
        "You are not authorized to perform this action"
      );
    }
    return req.user.parentUserId;
  }
  return req.user._id;
};
const checkUserAuthority = (req, requiredAuthority) => {
  if (req.user?.role === "user-member") {
    if (
      !req.user.authorities?.busOperatorAuthorities.includes(requiredAuthority)
    ) {
      throw new ApiError(
        statusCode.FORBIDDEN,
        "You are not authorized to perform this action"
      );
    }
    return req.user.parentUserId;
  }
  return req.user._id;
};

const getDayOfDate = (date) => {
  if (!moment(date, "YYYY-MM-DD", true).isValid()) {
    return "Invalid date format. Use YYYY-MM-DD.";
  }
  return moment(date).format("dddd");
};

const getStatusMessage = (status) => {
  switch (status) {
    case "processing":
      return "You application is under processing. Please wait for the Admin's Approval";
    case "submitted":
      return "You are just register yourself. Please wait for the Admin's Approval";
    case "rejected":
      return "Your account has been rejected. Please contact Support for more details";
    case "blocked":
      return "Your account has been blocked. Please contact Support for more details";
    case "approved":
      return "Your account has been approved. Please Login to continue";
    default:
      return "Your account is awaiting admin approval.";
  }
};

const getDateRange = (filter) => {
  const now = moment();
  const today = now.endOf("day");

  switch (filter) {
    case "daily":
      return {
        startDate: moment().startOf("day").toDate(),
        endDate: today.toDate(),
      };
    case "weekly":
      return {
        startDate: moment().startOf("isoWeek").toDate(),
        endDate: today.toDate(),
      };
    case "monthly":
      return {
        startDate: moment().startOf("month").toDate(),
        endDate: today.toDate(),
      };
    case "yearly":
      return {
        startDate: moment().startOf("year").toDate(),
        endDate: today.toDate(),
      };
    default:
      return null;
  }
};

module.exports = {
  formatDistanceTime,
  validateRequestBody,
  normalizeDate,
  getTodayNormalized,
  validateRole,
  checkBusOperatorAuthority,
  getDayOfDate,
  isValidFutureDate,
  logNormalizedDate,
  getStatusMessage,
  validateMongooseId,
  getDateRange,
  checkUserAuthority
};
