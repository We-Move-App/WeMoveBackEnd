const {
  AdminModel,
  defaultPermissions,
} = require("../../../models/admin-module/admin/admin.model");
const Joi = require("joi");
const statusCode = require("../../../utils/constants/statusCode");
const {
  generateTokens,
  setTokenCookies,
} = require("../../../utils/jwtToken/generateTokens");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  saveDeviceToken,
  removeDeviceToken,
} = require("../../../utils/services/deviceToken.services");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const AdminDeviceTokenModel = require("../../../models/admin-module/admin-device-tokens/admin-device-tokens.model");
const {
  TypeOfUser,
  adminAuthorities,
} = require("../../../utils/constants/constants");

const UserModel = require("../../../models/user-module/users/user.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const Admin = require("../../../models/admin-module/admin/admin.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const { logActivity } = require("../../../utils/ActivityLog/ActivityLog");
const { format, differenceInCalendarDays } = require("date-fns");
const { getFinalPrice } = require("../../../utils/services/prices.services");
const {
  updateAvatarFunc,
  resetPasswordFunc,
  changePasswordFunc,
  getAvatarFunc,
} = require("../../../utils/services/functions.services");
const bcrypt = require("bcrypt");
const { hash_rounds } = process.env;
const {
  busOperatorAuthorities,
} = require("../../../utils/constants/constants");
const BranchModel = require("../../../models/admin-module/branch/branches.model");
const {
  UserActivityModel,
} = require("../../../models/admin-module/ActivityModel/ActivityModel");
const {
  CouponModel,
} = require("../../../models/admin-module/Admin-coupon/adminCouponModel");
const { formatDistanceToNowStrict } = require("date-fns");
const Transaction = require("../../../models/transaction-module/transaction.model");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");
const moment = require("moment");
const {
  sendOtpToEmail,
  verifyEmailOtp,
} = require("../../../utils/otpService/otpService");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const TransactionModel = require("../../../models/transaction-module/transaction.model");
const { fetchAdminLn } = require("../../../utils/services/user.services");
const {
  translateLn,
  formatTranslatedActivity,
} = require("../../../utils/services/translator.service");

const roleMap = {
  Admin: "ADMIN",
  SubAdmin: "SUB_ADMIN",
  SuperAdmin: "SUPER_ADMIN",
};

const permissionMap = {
  userManagement: "USER_MANAGEMENT",
  busManagement: "BUS_MANAGEMENT",
  taxiManagement: "TAXI_MANAGEMENT",
  bikeManagement: "BIKE_MANAGEMENT",
  hotelManagement: "HOTEL_MANAGEMENT",
  walletManagement: "WALLET_MANAGEMENT",
  reportsAnalytics: "REPORTS_ANALYTICS",
  notifications: "NOTIFICATIONS",
  roleManagement: "ROLE_MANAGEMENT",
  commissionManagement: "COMMISSION_MANAGEMENT",
  couponManagement: "COUPON_MANAGEMENT",
  referralManagement: "REFERRAL_MANAGEMENT",
};

const addAdmins = catchAsyncError(async (req, res, next) => {
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const {
    email,
    userName,
    phoneNumber,
    branch,
    role,
    permissions,
    // isSpecialAdmin,
  } = req.body;
  const { _id, performedBy } = req.user;

  const isRoleValid = ["Admin", "SubAdmin"].includes(role);
  if (!isRoleValid) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INVALID_ADMIN_ROLE")
    );
  }

  const reqField = [
    "email",
    "userName",
    "phoneNumber",
    "branch",
    "role",
    // "isSpecialAdmin",
    "permissions",
  ];
  validateRequestBody(reqField, req.body, ln);

  if (typeof permissions !== "object" || Array.isArray(permissions)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "PERMISSIONS_OBJECT_REQUIRED")
    );
  }

  const validPermissions = Object.keys(defaultPermissions);
  const invalidPermissions = Object.keys(permissions).filter(
    (key) => !validPermissions.includes(key)
  );

  if (invalidPermissions.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INVALID_PERMISSIONS")
    );
  }

  const existingUser = await AdminModel.findOne({
    $or: [{ email }, { phoneNumber }, { userName }],
  });
  if (existingUser) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ADMIN_ALREADY_EXISTS")
    );
  }

  const defaultPassword = "Admin@123";
  const adminId = await generateCustomId(EntityCodeEnum.ADMIN, "A");

  const newUser = new AdminModel({
    adminId,
    email,
    userName,
    password: defaultPassword,
    phoneNumber,
    role,
    // isSpecialAdmin,
    branch,
    permissions: { ...defaultPermissions, ...permissions },
    parentUserId: _id,
    createdBy: performedBy,
    updatedBy: performedBy,
    reportingManager: req.body.reportingManager,
  });

  await newUser.save();

  const logs = await logActivity({
    userId: newUser._id,
    activity: `Created a new ${role} with username: ${userName}`,
    performedBy: _id, // use logged-in user’s id
  });

  const userObject = newUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    newUser,
    TypeOfUser.ADMIN
  );
  setTokenCookies(res, accessToken, refreshToken);

  const data = {
    accessToken,
    refreshToken,
    user: userObject,
    logs,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        data,
        translateLn(ln, "ADMIN_CREATED_SUCCESS")
      )
    );
});

const addSubAdmins = catchAsyncError(async (req, res, next) => {
  const { _id: performedBy, role: loggedInRole, branch: userBranch } = req.user;

  const ln = (req.headers["ln"] || "en").toLowerCase();

  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.empty": "EMAIL_REQUIRED",
      "any.required": "EMAIL_REQUIRED",
      "string.email": "INVALID_EMAIL",
    }),

    userName: Joi.string().min(3).required().messages({
      "string.empty": "USERNAME_REQUIRED",
      "any.required": "USERNAME_REQUIRED",
      "string.min": "USERNAME_MIN_3",
    }),

    phoneNumber: Joi.string().required().messages({
      "string.empty": "PHONE_REQUIRED",
      "any.required": "PHONE_REQUIRED",
    }),

    role: Joi.string().valid("Admin", "SubAdmin").required().messages({
      "string.empty": "ROLE_REQUIRED",
      "any.required": "ROLE_REQUIRED",
      "any.only": "INVALID_ROLE",
    }),

    branch: Joi.string().optional(),

    reportingManager: Joi.string().optional(),

    permissions: Joi.object().optional().messages({
      "object.base": "INVALID_PERMISSIONS",
    }),

    // isSpecialAdmin: Joi.boolean().optional().messages({
    //   "boolean.base": "INVALID_BOOLEAN",
    // }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    throw new ApiError(400, translateLn(ln, error.details[0].message));
  }

  let {
    email,
    userName,
    phoneNumber,
    role,
    // isSpecialAdmin,
    branch,
    reportingManager,
    permissions,
  } = value;

  if (loggedInRole === "Admin" && role === "SubAdmin") {
    reportingManager = performedBy;
    branch = userBranch;
  }

  if (
    loggedInRole === "SuperAdmin" &&
    role === "SubAdmin" &&
    !reportingManager
  ) {
    throw new ApiError(400, translateLn(ln, "REPORTING_MANAGER_REQUIRED"));
  }

  if (!["Admin", "SuperAdmin"].includes(loggedInRole)) {
    throw new ApiError(
      403,
      translateLn(ln, "ONLY_ADMIN_SUPERADMIN_CREATE_SUBADMIN")
    );
  }

  const existingUser = await AdminModel.findOne({
    $or: [{ email }, { phoneNumber }, { userName }],
  });

  if (existingUser) {
    throw new ApiError(400, translateLn(ln, "USER_ALREADY_EXISTS"));
  }

  const defaultPassword = "subadmin@123";

  const adminId = await generateCustomId(EntityCodeEnum.ADMIN, "A");

  const newUser = new AdminModel({
    adminId,
    email: email.trim().toLowerCase(),
    userName: userName.trim(),
    phoneNumber: phoneNumber.trim(),
    role,
    // isSpecialAdmin: isSpecialAdmin ?? false,
    branch,
    reportingManager,
    permissions: {
      ...defaultPermissions,
      ...(permissions || {}),
    },
    parentUserId: performedBy,
    createdBy: performedBy,
    updatedBy: performedBy,
    password: defaultPassword,
  });

  await newUser.save();

  const logs = await logActivity({
    userId: newUser._id,
    activity: `Created a new ${role} with username: ${userName}`,
    performedBy,
  });

  const userObject = newUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    newUser,
    TypeOfUser.ADMIN
  );

  setTokenCookies(res, accessToken, refreshToken);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        refreshToken,
        user: userObject,
        logs,
      },
      translateLn(
        ln,
        role === "Admin" ? "ADMIN_CREATED_SUCCESS" : "SUBADMIN_CREATED_SUCCESS"
      )
    )
  );
});

const loginAdmin = catchAsyncError(async (req, res, next) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password?.trim()) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter email or phone or username and password"
    );
  }

  // Check if the user already exists by email and phoneNumber
  const existingUser = await AdminModel.findOne({
    $or: [
      { email: username },
      { phoneNumber: username },
      { userName: username },
    ],
  });

  if (!existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, `User not found`);
  }

  if (existingUser?.password === undefined) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You registered with OTP!. Please reset your password"
    );
  }

  const isPasswordMatch = await existingUser.comparePassword(password);

  if (!isPasswordMatch) {
    throw new ApiError(statusCode.BAD_REQUEST, `Invalid Credentials`);
  }

  const userObject = existingUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    existingUser,
    TypeOfUser.ADMIN
  );
  setTokenCookies(res, accessToken, refreshToken);

  const activityLog = await logActivity({
    userId: existingUser._id,
    activity: "Logged in successfully",
    type: "login",
    performedBy: existingUser._id,
  });

  const data = {
    accessToken,
    refreshToken,
    UserActivity: activityLog,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, `Login Successfully`));
});

const saveDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = AdminDeviceTokenModel;

  const response = await saveDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );

  // Log activity and get formatted log
  const activityLog = await logActivity({
    userId: req.user._id,
    activity: "Saved device token",
    type: "update", // Use a proper type: "login", "create", "update", "delete", "download"
    performedBy: req.user._id,
  });

  // Build final response
  const data = {
    result: response,
    UserActivity: activityLog,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, data, "Device token saved successfully")
    );
});
const removeDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = AdminDeviceTokenModel;

  const response = await removeDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );

  // Log activity and get formatted log
  const activityLog = await logActivity({
    userId: req.user._id,
    activity: "Removed device token",
    type: "delete", // Type is delete since we are removing
    performedBy: req.user._id,
  });

  // Build final response
  const data = {
    result: response,
    UserActivity: activityLog,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, data, "Device token removed successfully")
    );
});

const getAllAdmins = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skipIndex = (page - 1) * limit;
  const { role, search } = req.query;

  // Logged in user details (from token middleware)
  const loggedInUser = req.user;
  if (!loggedInUser) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Unauthorized");
  }

  const ln = await fetchAdminLn(loggedInUser._id);

  // Base filter
  let matchQuery = {};

  if (loggedInUser.role === "SuperAdmin") {
    // SuperAdmin → show all Admin + SubAdmin
    matchQuery.role = { $in: ["Admin", "SubAdmin"] };
  } else if (loggedInUser.role === "Admin") {
    // Admin → only SubAdmins under him
    matchQuery = { role: "SubAdmin", reportingManager: loggedInUser._id };
  } else {
    // SubAdmin should not fetch
    throw new ApiError(statusCode.FORBIDDEN, "Access denied");
  }

  // Apply role filter from query param (optional)
  if (role) {
    matchQuery.role = role;
  }

  // Search
  const searchQuery = search
    ? {
        $or: [
          { userName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
          { role: { $regex: search, $options: "i" } },
          { "branchData.name": { $regex: search, $options: "i" } },
        ],
      }
    : {};

  // Aggregation
  const pipeline = [
    { $match: matchQuery },
    {
      $lookup: {
        from: "branches",
        localField: "branch",
        foreignField: "_id",
        as: "branchData",
      },
    },
    { $unwind: { path: "$branchData", preserveNullAndEmptyArrays: true } },
    { $match: searchQuery },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        data: [{ $skip: skipIndex }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const results = await AdminModel.aggregate(pipeline);
  const totalUser = results[0]?.totalCount[0]?.count || 0;
  const allUsers = results[0]?.data || [];

  if (!allUsers.length) {
    throw new ApiError(statusCode.NOT_FOUND, "No users found");
  }

  const users = allUsers.map((user) => {
    let truePermissionCount = 0;

    if (Array.isArray(user.permissions)) {
      truePermissionCount = user.permissions.filter(
        (perm) =>
          perm === true ||
          (typeof perm === "object" && Object.values(perm).some(Boolean))
      ).length;
    } else if (
      typeof user.permissions === "object" &&
      user.permissions !== null
    ) {
      truePermissionCount = Object.values(user.permissions).filter(
        Boolean
      ).length;
    }

    return {
      _id: user._id,
      name: user.userName,
      phoneNumber: user.phoneNumber,
      reportingManager: user.reportingManager,
      email: user.email,
      role: translateLn(ln, roleMap[user.role] || user.role),
      permissionsCount: truePermissionCount,
      createdAt: user.createdAt,
      branch: user.branchData
        ? {
            branchId: user.branchData._id,
            name: user.branchData.name,
            location: user.branchData.location,
            createdAt: user.branchData.createdAt,
          }
        : null,
    };
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      success: true,
      message: "Fetched successfully",
      total: totalUser,
      page,
      limit,
      sortBy: "createdAt",
      order: "desc",
      data: users,
    })
  );
});

const getSubAdminsByBranch = catchAsyncError(async (req, res) => {
  const { role, _id } = req.user; // authenticated admin

  if (role !== "Admin") {
    throw new ApiError(403, "Only Admins can access this resource");
  }

  const admin = await AdminModel.findById(_id);
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  const subAdmins = await AdminModel.find({
    branch: admin.branch,
    role: "SubAdmin",
  })
    .populate("reportingManager", "userName email phoneNumber")
    .populate("branch", "name location")
    .select("-password");

  if (subAdmins.length === 0) {
    throw new ApiError(404, "No SubAdmins found in your branch", {
      branch: admin.branch,
    });
  }

  const subAdminsWithActivity = await Promise.all(
    subAdmins.map(async (subAdmin) => {
      const lastActivity = await UserActivityModel.findOne({
        userId: subAdmin._id,
      })
        .sort({ createdAt: -1 })
        .populate("performedBy", "email role")
        .select("activity createdAt -_id")
        .lean();

      let logs = null;
      if (lastActivity) {
        logs = {
          lastActivity: null, // keep null if needed separately
          recentActivity: {
            activity: lastActivity.activity,
            time: moment(lastActivity.createdAt).calendar(), // e.g., Today, 12:07 PM
            performedBy: lastActivity.performedBy || null,
          },
        };
      }

      return {
        ...subAdmin.toObject(),
        lastActivity: lastActivity || null,
      };
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subAdminsWithActivity,
        "SubAdmins fetched successfully"
      )
    );
});

const getAdminById = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const ln = (req.headers["ln"] || "en").toLowerCase();

  const admin = await AdminModel.findById(id)
    .populate("branch", "name location")
    .populate("reportingManager", "userName phoneNumber email");

  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "NO_USER_FOUND"));
  }

  // Get last activity of this admin
  const lastActivity = await UserActivityModel.findOne({ userId: id })
    .sort({ createdAt: -1 })
    .select("activity createdAt -_id");
  console.log(lastActivity);

  const translatedActivity = lastActivity?.activity
    ? translateLn(ln, lastActivity.activity)
    : null;

  // Format response
  const formattedAdmin = {
    _id: admin._id,
    userName: admin.userName,
    email: admin.email,
    phoneNumber: admin.phoneNumber,
    role: translateLn(ln, roleMap[admin.role] || admin.role),
    permissions: Object.keys(admin.permissions || {}).reduce((acc, key) => {
      const translatedKey = permissionMap[key] || key;
      acc[translateLn(ln, translatedKey)] = admin.permissions[key];
      return acc;
    }, {}),

    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
    branch: admin.branch
      ? {
          branchId: admin.branch?._id,
          name: admin.branch.name || null,
          location: admin.branch.location || null,
        }
      : {
          branchId: null,
          name: null,
          location: null,
        },
    reportingManager: admin.reportingManager
      ? {
          id: admin.reportingManager._id,
          userName: admin.reportingManager.userName,
          phoneNumber: admin.reportingManager.phoneNumber,
          email: admin.reportingManager.email,
        }
      : null,
    UserActivity: lastActivity
      ? {
          activity:
            translatedActivity === "Something went wrong"
              ? lastActivity.activity
              : translatedActivity,
          time: lastActivity.createdAt,
        }
      : null,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        formattedAdmin,
        translateLn(ln, "DATA_FOUND")
      )
    );
});

const getProfile = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const admin = await AdminModel.findById(_id);

  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "No user found");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, admin, "Data found successfully"));
});

const getAvatar = catchAsyncError(async (req, res, next) => {
  const result = await getAvatarFunc({
    req,
    reqModel: AdminModel,
  });

  return res.status(statusCode.OK).json({
    ...result,
  });
});

const updateAvatar = catchAsyncError(async (req, res, next) => {
  const result = await updateAvatarFunc({
    req,
    res,
    reqModel: AdminModel,
  });
  const activityLog = await logActivity({
    userId: req.user._id,
    activity: "Updated profile avatar",
    type: "update", // Type of activity
    performedBy: req.user._id,
  });

  return res.status(statusCode.OK).json({
    ...result,
    UserActivity: activityLog,
  });
});

const changePassword = catchAsyncError(async (req, res, next) => {
  const result = await changePasswordFunc({
    req,
    res,
    reqModel: AdminModel,
  });
  const activityLog = await logActivity({
    userId: req.user._id,
    activity: "Changed password",
    type: "update",
    performedBy: req.user._id,
  });

  return res.status(statusCode.OK).json({
    ...result,
    UserActivity: activityLog,
  });
});

const resetPassword = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc({
    req,
    res,
    reqModel: AdminModel,
  });

  const activityLog = await logActivity({
    userId: req.user._id,
    activity: "Reset password",
    type: "update", // Type is update
    performedBy: req.user._id,
  });

  return res.status(statusCode.OK).json({
    ...result,
    UserActivity: activityLog,
  });
});

const addSuperAdmin = catchAsyncError(async (req, res, next) => {
  const { email, userName, password, phoneNumber } = req.body;

  const reqField = ["email", "userName", "password", "phoneNumber"];
  validateRequestBody(reqField, req.body);

  const existingUser = await AdminModel.findOne({
    $or: [{ email }, { phoneNumber }, { userName }],
  });

  console.log(existingUser);
  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "SuperAdmin already exists");
  }

  const allPermissions = {
    userManagement: true,
    busManagement: true,
    driverManagement: true,
    hotelManagement: true,
    walletManagement: true,
    reportsAnalytics: true,
    notifications: true,
    roleManagement: true,
  };

  const newUser = new AdminModel({
    email,
    userName,
    password,
    phoneNumber,
    role: "SuperAdmin",
    permissions: allPermissions,
  });

  await newUser.save();

  const userObject = newUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    newUser,
    TypeOfUser.ADMIN
  );
  setTokenCookies(res, accessToken, refreshToken);

  const activityLog = await logActivity({
    userId: newUser._id,
    activity: "SuperAdmin account created",
    type: "create",
    performedBy: newUser._id,
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        accessToken,
        refreshToken,
        user: userObject,
        userActivity: activityLog,
      },
      "SuperAdmin created successfully"
    )
  );
});
const updateAdmin = catchAsyncError(async (req, res, next) => {
  const { adminId } = req.params;
  const { _id: updatedBy, role: currentUserRole } = req.user;
  if (currentUserRole !== "SuperAdmin") {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "Only SuperAdmin can update admins"
    );
  }
  if (!adminId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Admin ID is required");
  }
  const admin = await AdminModel.findById(adminId);
  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
  }
  const { userName, email, role, permissions } = req.body;
  if (userName) {
    const existingUserName = await AdminModel.findOne({
      userName,
      _id: { $ne: adminId },
    });
    if (existingUserName) {
      throw new ApiError(statusCode.BAD_REQUEST, "Username already in use");
    }
    admin.userName = userName;
  }
  if (email) {
    const existingEmail = await AdminModel.findOne({
      email,
      _id: { $ne: adminId },
    });
    if (existingEmail) {
      throw new ApiError(statusCode.BAD_REQUEST, "Email already in use");
    }
    admin.email = email;
  }
  if (role) {
    const isRoleValid = ["Admin", "SubAdmin"].includes(role);
    if (!isRoleValid) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Role must be Admin or SubAdmin"
      );
    }
    admin.role = role;
  }

  if (permissions && typeof permissions === "object") {
    const allowedPermissions = Object.keys(defaultPermissions);

    const updatedPermissions = { ...admin.permissions };

    Object.keys(permissions).forEach((perm) => {
      if (allowedPermissions.includes(perm)) {
        updatedPermissions[perm] = !!permissions[perm];
      }
    });

    admin.permissions = updatedPermissions;
  }

  await admin.save();

  const logs = await logActivity({
    userId: admin._id,
    activity: `Updated admin: ${admin.userName}`,
    type: "update",
    performedBy: updatedBy,
  });

  const userObject = admin.toObject();
  delete userObject.password;

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { user: userObject, logs },
        "updated successfully"
      )
    );
});
const updateSubAdmin = catchAsyncError(async (req, res, next) => {
  const { adminId } = req.params;
  const {
    _id: updatedBy,
    role: currentUserRole,
    branch: currentUserBranch,
  } = req.user;

  if (!adminId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Admin ID is required");
  }

  const admin = await AdminModel.findById(adminId);
  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
  }

  // Only SuperAdmin or Admin of the same branch can update
  if (currentUserRole !== "SuperAdmin") {
    // Admin cannot update SuperAdmin
    if (admin.role === "SuperAdmin") {
      throw new ApiError(statusCode.FORBIDDEN, "Cannot update SuperAdmin");
    }
    // Admin can update only SubAdmin in their branch
    if (admin.branch.toString() !== currentUserBranch.toString()) {
      throw new ApiError(
        statusCode.FORBIDDEN,
        "You can update only SubAdmins in your branch"
      );
    }
  }

  const { userName, email, role, permissions } = req.body;

  if (userName) {
    const existingUserName = await AdminModel.findOne({
      userName,
      _id: { $ne: adminId },
    });
    if (existingUserName) {
      throw new ApiError(statusCode.BAD_REQUEST, "Username already in use");
    }
    admin.userName = userName;
  }

  if (email) {
    const existingEmail = await AdminModel.findOne({
      email,
      _id: { $ne: adminId },
    });
    if (existingEmail) {
      throw new ApiError(statusCode.BAD_REQUEST, "Email already in use");
    }
    admin.email = email;
  }

  if (role) {
    const isRoleValid = ["Admin", "SubAdmin"].includes(role);
    if (!isRoleValid) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Role must be Admin or SubAdmin"
      );
    }
    // Admin cannot promote anyone to SuperAdmin
    admin.role = role;
  }

  if (permissions && typeof permissions === "object") {
    const allowedPermissions = Object.keys(defaultPermissions);
    const updatedPermissions = { ...admin.permissions };
    Object.keys(permissions).forEach((perm) => {
      if (allowedPermissions.includes(perm)) {
        updatedPermissions[perm] = !!permissions[perm];
      }
    });
    admin.permissions = updatedPermissions;
  }

  await admin.save();

  const logs = await logActivity({
    userId: admin._id,
    activity: `Updated admin: ${admin.userName}`,
    type: "update",
    performedBy: updatedBy,
  });

  const userObject = admin.toObject();
  delete userObject.password;

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { user: userObject, logs },
        "updated successfully"
      )
    );
});

const createCoupon = catchAsyncError(async (req, res) => {
  const ln = (req.headers["ln"] || "en").toLowerCase();
  let {
    couponName,
    couponCode,
    header,
    serviceType,
    discountType,
    minOrderAmount,
    discountPercentage,
    discountAmount,
    startDate,
    expiryDate,
    status,
  } = req.body;

  const { _id: performedBy, role } = req.user;
  couponName = couponName?.trim().toUpperCase();
  couponCode = couponCode?.trim().toUpperCase();
  header = header?.trim().toUpperCase();

  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      translateLn(ln, "ONLY_ADMIN_CREATE_COUPON")
    );
  }

  const duplicateCoupon = await CouponModel.findOne({
    $or: [{ couponCode }, { couponName }],
  });

  if (duplicateCoupon) {
    if (duplicateCoupon.couponCode === couponCode) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "COUPON_CODE_ALREADY_EXISTS")
      );
    }

    if (duplicateCoupon.couponName === couponName) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "COUPON_NAME_ALREADY_EXISTS")
      );
    }
  }
  const errors = [];

  if (!couponName) errors.push(translateLn(ln, "COUPON_NAME_REQUIRED"));

  if (!couponCode) errors.push(translateLn(ln, "COUPON_CODE_REQUIRED"));

  if (errors.length) {
    throw new ApiError(statusCode.BAD_REQUEST, errors.join(", "));
  }

  const start = new Date(startDate?.trim());
  const expiry = new Date(expiryDate?.trim());

  if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INVALID_DATE_FORMAT")
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  start.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  // Check that start date is not in the past
  if (start < today) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "START_DATE_PAST")
    );
  }

  if (expiry <= start) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "EXPIRY_AFTER_START")
    );
  }

  // Create coupon
  const newCoupon = await CouponModel.create({
    couponName,
    couponCode,
    header,
    serviceType,
    discountType,
    discountPercentage,
    discountAmount,
    minOrderAmount,
    startDate: start,
    expiryDate: expiry,
    status,
    createdBy: performedBy,
  });

  const activityLog = await logActivity({
    userId: performedBy,
    activity: `Created a new coupon ${couponName} (${couponCode})`,
    performedBy,
  });

  res.status(statusCode.CREATED).json({
    success: true,
    message: translateLn(ln, "COUPON_CREATED_SUCCESS"),
    data: newCoupon,
    activityLog,
  });
});

const updateCoupon = catchAsyncError(async (req, res) => {
  const { couponId } = req.params;
  const { couponName } = req.body;
  const updateData = req.body;
  const ln = (req.headers["ln"] || "en").toLowerCase();
  const { _id: performedBy, role } = req.user;

  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      translateLn(ln, "ONLY_ADMIN_UPDATE_COUPON")
    );
  }

  const coupon = await CouponModel.findById(couponId);
  if (!coupon) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "COUPON_NOT_FOUND")
    );
  }

  const existingCouponName = await CouponModel.findOne({
    couponName,
    _id: { $ne: couponId },
  });

  if (existingCouponName) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "COUPON_NAME_ALREADY_EXISTS")
    );
  }

  if (
    coupon.status === "Inactive" &&
    updateData.status === "Active" &&
    coupon.expiryDate < new Date()
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Cannot change status of expired coupon from Inactive to Active"
    );
  }

  Object.assign(coupon, updateData, { updatedBy: performedBy });
  await coupon.save();

  const activityLog = await logActivity({
    userId: performedBy,
    activity: `Updated coupon ${coupon.couponName} (${coupon.couponCode})`,
    performedBy,
  });

  res.status(statusCode.OK).json({
    success: true,
    message: translateLn(ln, "COUPON_UPDATED_SUCCESS"),
    data: coupon,
    activityLog,
  });
});

const updateCouponStatus = catchAsyncError(async (req, res) => {
  const { couponId } = req.params;
  const { status } = req.body;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  if (!status) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "STATUS_REQUIRED")
    );
  }

  // Find coupon
  const coupon = await CouponModel.findById(couponId);
  if (!coupon) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "COUPON_NOT_FOUND")
    );
  }

  // Save old status
  const oldStatus = coupon.status;

  // Update only status
  coupon.status = status;
  coupon.updatedBy = req.user._id;
  await coupon.save();

  // Log activity
  await logActivity({
    userId: req.user._id,
    activity: `Updated coupon status from ${oldStatus} to ${status}`,
    performedBy: req.user._id,
  });

  // Return only status in response
  return res.status(statusCode.OK).json({
    success: true,
    message: translateLn(ln, "COUPON_STATUS_UPDATED_SUCCESS"),
    data: {
      oldStatus,
      newStatus: status,
    },
  });
});

const getAllCoupons = catchAsyncError(async (req, res) => {
  const { role } = req.user;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      translateLn(ln, "ONLY_ADMIN_VIEW_COUPONS")
    );
  }

  let {
    search,
    status,
    serviceType,
    startDate,
    endDate,
    page,
    limit,
    sortBy,
    order,
  } = req.query;

  page = page ? Math.max(parseInt(page, 10), 1) : 1;
  limit = limit ? Math.max(parseInt(limit, 10), 1) : 12;

  const skip = (page - 1) * limit;
  sortBy = sortBy || "createdAt";
  order = order === "asc" ? 1 : -1;

  const filter = {};

  // Search
  if (search) {
    filter.$or = [
      { couponCode: { $regex: search, $options: "i" } },
      { couponName: { $regex: search, $options: "i" } },
      { serviceType: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status && status !== "All") {
    filter.status = status;
  }

  // ServiceType filter
  if (serviceType && serviceType !== "All" && serviceType.trim() !== "") {
    filter.serviceType = serviceType.trim();
  }

  // Date filter
  if (startDate && endDate) {
    filter.startDate = { $gte: new Date(startDate) };
    filter.expiryDate = { $lte: new Date(endDate) };
  }

  const total = await CouponModel.countDocuments(filter);

  // ✅ if no data found after search/filter
  if (total === 0) {
    return res.status(200).json({
      success: true,
      total: 0,
      page,
      limit,
      totalPages: 0,
      message: translateLn(ln, "NO_COUPONS_FOUND"),
      data: [],
    });
  }

  const coupons = await CouponModel.find(filter)
    .sort({ [sortBy]: order })
    .skip(skip)
    .limit(limit)
    .lean();

  // change only inside map()

  const data = coupons.map((c) => ({
    couponId: c._id,
    couponName: c.couponName,
    header: c.header,
    couponCode: c.couponCode,

    // ✅ translated serviceType
    serviceType: translateLn(ln, c.serviceType),

    discount:
      c.discountType === "Percentage"
        ? `${c.discountPercentage}%`
        : `₹${c.discountAmount}`,

    startDate: c.startDate,
    expiryDate: c.expiryDate,

    // ✅ translated status
    status: translateLn(ln, c.status),
  }));

  res.status(200).json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
  });
});

const getCouponById = catchAsyncError(async (req, res) => {
  const { _id, role } = req.user;

  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "Only SuperAdmin or Admin can view coupon"
    );
  }

  const { id } = req.params;

  const coupon = await CouponModel.findById(id).lean();

  if (!coupon) {
    throw new ApiError(statusCode.NOT_FOUND, "Coupon not found");
  }

  const data = [
    {
      couponName: coupon.couponName,
      couponCode: coupon.couponCode,
      serviceType: coupon.serviceType,
      header: coupon.header,
      discount:
        coupon.discountType === "Percentage"
          ? `${coupon.discountPercentage}%`
          : `₹${coupon.discountAmount}`,
      startDate: coupon.startDate,
      expiryDate: coupon.expiryDate,
      status: coupon.status,
    },
  ];

  res.status(200).json({
    success: true,
    total: 1,
    page: 1,
    limit: 1,
    totalPages: 1,
    data,
  });
});

const getUserActivities = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, type, startDate, endDate } = req.query;

    const ln = (req.headers["ln"] || "en").toLowerCase();

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: translateLn(ln, "USER_ID_REQUIRED"),
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = { userId };

    if (type) filter.type = type;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (!isNaN(start) && !isNaN(end)) {
        filter.createdAt = { $gte: start, $lte: end };
      }
    }

    const activities = await UserActivityModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("performedBy", "name email role")
      .lean();

    const total = await UserActivityModel.countDocuments(filter);

    if (!activities.length) {
      return res.status(404).json({
        success: false,
        message: translateLn(ln, "NO_ACTIVITIES_FOUND"),
      });
    }

    const formatActivityTime = (date) => {
      if (!date) return null;

      const now = new Date();
      const daysDiff = differenceInCalendarDays(now, date);

      if (daysDiff === 0) {
        return `Today, ${format(
          date,
          "hh:mm a"
        )} (${formatDistanceToNowStrict(date)} ago)`;
      }

      if (daysDiff === 1) {
        return `Yesterday, ${format(
          date,
          "hh:mm a"
        )} (${formatDistanceToNowStrict(date)} ago)`;
      }

      return `${format(date, "eee, dd MMM, hh:mm a")} (${formatDistanceToNowStrict(
        date
      )} ago)`;
    };

    const formattedActivities = activities.map((act) => ({
      activity: formatTranslatedActivity(act.activity, ln),
      type: act.type,
      time: formatActivityTime(act.createdAt),
      performedBy: act.performedBy
        ? {
            _id: act.performedBy._id,
            name: act.performedBy.name,
            email: act.performedBy.email,
            role: act.performedBy.role,
          }
        : null,
    }));

    const recentActivity = formattedActivities[0] || null;
    const lastActivity =
      formattedActivities.length > 1 ? formattedActivities[1] : null;

    return res.status(200).json({
      success: true,
      message: translateLn(ln, "DATA_FOUND"),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      filters: {
        type: type || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      lastActivity,
      recentActivity,
      data: formattedActivities,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: translateLn(
        (req.headers["ln"] || "en").toLowerCase(),
        "SERVER_ERROR_FETCHING_ACTIVITIES"
      ),
    });
  }
};

const getTransactionHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const ln = (req.headers["ln"] || "en").toLowerCase();

    const { search = "", type = "ALL", status = "ALL" } = req.query;

    const round2 = (n) => Number(Number(n || 0).toFixed(2));

    const query = {};

    if (status && status !== "ALL") {
      query.status = { $regex: new RegExp(`^${status}$`, "i") };
    }

    if (type && type !== "ALL") {
      query.entries = {
        $elemMatch: {
          type: { $regex: new RegExp(`^${type}$`, "i") },
        },
      };
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { transactionId: regex },
        { description: regex },
        { "entries.name": regex },
      ];
    }

    const transactions = await TransactionModel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const results = [];

    for (const txn of transactions) {
      const entries = Array.isArray(txn.entries) ? txn.entries : [];

      const pickEntry =
        entries.find((e) => e.entityType === "USER") ||
        entries.find((e) => e.entityType === "BUS_OPERATOR") ||
        entries.find((e) => e.entityType === "HOTEL") ||
        entries.find((e) => e.entityType === "DRIVER") ||
        entries.find((e) => e.entityType === "ADMIN") ||
        entries[0] ||
        null;

      const entityType = pickEntry?.entityType || null;
      const entityId = pickEntry?.entityId ?? null;

      let name = null;
      let role = null;

      const mongoose = require("mongoose");

      if (entityType === "USER" && entityId) {
        let user = null;

        if (mongoose.Types.ObjectId.isValid(entityId)) {
          user = await UserModel.findById(entityId, "fullName role").lean();
        } else {
          user = await UserModel.findOne(
            { userId: entityId },
            "fullName role"
          ).lean();
        }

        name = user?.fullName || "Unknown User";
        role = user?.role || "user";
      } else if (entityType === "BUS_OPERATOR" && entityId) {
        const op = await BusOperatorModel.findById(
          entityId,
          "fullName role"
        ).lean();
        name = op?.fullName || "Unknown Bus Operator";
        role = op?.role || "bus-operator";
      } else if (entityType === "HOTEL" && entityId) {
        const hm = await HotelManagerModel.findById(
          entityId,
          "fullName role"
        ).lean();
        name = hm?.fullName || "Unknown Hotel Manager";
        role = hm?.role || "hotel-manager";
      } else if (entityType === "ADMIN" && entityId) {
        const admin = await AdminModel.findById(
          entityId,
          "userName role"
        ).lean();
        name = admin?.userName || "Unknown Admin";
        role = admin?.role || null;
      } else if (entityType === "DRIVER" && entityId) {
        const driver = await DriverBasicDetails.findOne(
          { driverId: entityId },
          "fullName role"
        ).lean();
        name = driver?.fullName || "Unknown Driver";
        role = driver?.role || "Driver";
      } else {
        name = "System";
        role = "System";
      }

      results.push({
        transactionId: txn.transactionId,
        name,
        role: translateLn(ln, role),
        type: pickEntry?.type || null,
        amount:
          pickEntry?.amount != null
            ? round2(pickEntry.amount)
            : txn.totalAmount != null
              ? round2(txn.totalAmount)
              : 0,
        date: txn.createdAt,
        status: txn.status,
        description:
          typeof txn.description === "object"
            ? txn.description?.[ln] || txn.description?.en || ""
            : txn.description || "",
      });
    }

    const filteredResults = results.filter((item) => {
      if (!search) return true;
      const s = String(search).toLowerCase();

      return (
        (item.transactionId || "").toLowerCase().includes(s) ||
        (item.name || "").toLowerCase().includes(s) ||
        (item.role || "").toLowerCase().includes(s)
      );
    });

    const paginatedResults = filteredResults.slice(skip, skip + limit);

    const totalRecords = filteredResults.length;
    const totalPages = Math.ceil(totalRecords / limit);

    const total = await TransactionModel.countDocuments(query);

    const creditAgg = await TransactionModel.aggregate([
      { $match: { status: "SUCCESS" } },
      { $unwind: "$entries" },
      { $match: { "entries.type": "CREDIT" } },
      { $group: { _id: null, total: { $sum: "$entries.amount" } } },
    ]);

    const debitAgg = await TransactionModel.aggregate([
      { $match: { status: "SUCCESS" } },
      { $unwind: "$entries" },
      { $match: { "entries.type": "DEBIT" } },
      { $group: { _id: null, total: { $sum: "$entries.amount" } } },
    ]);

    const creditTotal = creditAgg.length > 0 ? round2(creditAgg[0].total) : 0;
    const debitTotal = debitAgg.length > 0 ? round2(debitAgg[0].total) : 0;

    res.json({
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalRecords: filteredResults.length,
      creditTotal,
      debitTotal,
      data: paginatedResults,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const adminAuthSendOtp = catchAsyncError(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "email is required" });
  }

  const admin = await AdminModel.findOne({ email: email });
  if (!admin) {
    return res.status(404).json({ success: false, message: "Admin not found" });
  }

  await sendOtpToEmail(email);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        null,
        "OTP sent to email successfully"
      )
    );
});

const adminAuthVerifyOtp = catchAsyncError(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "email and otp is required" });
  }

  await verifyEmailOtp(email, otp);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.CREATED, null, "OTP verified successfully")
    );
});

const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;

const adminResetPassword = catchAsyncError(async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "email, newPassword and confirmPassword are required",
    });
  }

  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 8 characters long and include at least one number and one special character",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Confirm password should match new password",
    });
  }

  const admin = await AdminModel.findOne({ email });
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: "Admin not found",
    });
  }

  admin.password = newPassword;
  await admin.save();

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.CREATED, null, "Reset successful"));
});

const adminUpdatePassword = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const admin = await AdminModel.findById(adminId);
  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
  }

  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "oldPassword, newPassword and confirmPassword are required",
    });
  }

  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 8 characters long and include at least one number and one special character",
    });
  }

  const isPasswordMatch = await admin.comparePassword(oldPassword);
  if (!isPasswordMatch) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid old password");
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Confirm password should match new password",
    });
  }

  if (oldPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password should not be the same as old password",
    });
  }

  admin.password = newPassword;
  await admin.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.CREATED, null, "Password updated successfully")
    );
});

const changeLn = catchAsyncError(async (req, res) => {
  const adminId = req.user._id;
  const { ln } = req.body;

  if (!ln) {
    throw new ApiError(statusCode.BAD_REQUEST, "ln is required");
  }

  if (!["fr", "en"].includes(ln)) {
    throw new ApiError(statusCode.BAD_REQUEST, "ln should be fr or en");
  }

  const admin = await AdminModel.findById(adminId);
  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
  }

  admin.ln = ln;
  await admin.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, null, "language changed successfully")
    );
});

module.exports = {
  addAdmins,
  loginAdmin,
  addSubAdmins,
  saveDeviceTokens,
  removeDeviceTokens,
  getAllAdmins,
  getAdminById,
  getProfile,
  getAvatar,
  updateAvatar,
  changePassword,
  resetPassword,
  createSuperAdmin: addSuperAdmin,
  updateAdmin,
  updateSubAdmin,
  getUserActivities,
  createCoupon,
  getCouponById,
  updateCoupon,
  updateCouponStatus,
  getAllCoupons,
  getSubAdminsByBranch,
  getTransactionHistory,
  adminAuthSendOtp,
  adminAuthVerifyOtp,
  adminResetPassword,
  adminUpdatePassword,
  changeLn,
};
