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
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");
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

// Register Admin
// const addAdmins = catchAsyncError(async (req, res, next) => {

//   const { email, userName, password, phoneNumber, branch, role, permissions } =
//     req.body;
//   const { _id, performedBy, } = req.user;
//   console.log(_id)

//   const isRoleValid = ["Admin", "SubAdmin"].includes(role);

//   if (!isRoleValid) {
//     throw new ApiError(statusCode.BAD_REQUEST, `You can add Admin role only`);
//   }
//   const reqField = [
//     "email",
//     "userName",
//     "password",
//     "phoneNumber",
//     "branch",
//     "role",
//     "permissions",
//   ];

//   validateRequestBody(reqField, req.body);

//   if (!Array.isArray(permissions) || permissions?.length === 0) {
//     throw new ApiError(statusCode.BAD_REQUEST, "permissions required in array");
//   }

//   const invalidPermissions = permissions.filter(
//     (permission) => !adminAuthorities.includes(permission)
//   );

//   if (invalidPermissions.length > 0) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed values: ${busOperatorAuthorities.join(", ")}`
//     );
//   }

//   const existingUser = await AdminModel.findOne({
//     $or: [
//       { email: email },
//       { phoneNumber: phoneNumber },
//       { userName: userName },
//     ],
//   });

//   if (existingUser) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Admin already exist");
//   }

//   // Map permissions array to object
//   const mappedPermissions = {
//     userManagement: permissions.includes("userManagement"),
//     busManagement: permissions.includes("busManagement"),
//     driverManagement: permissions.includes("driverManagement"),
//     hotelManagement: permissions.includes("hotelManagement"),
//     walletManagement: permissions.includes("walletManagement"),
//     reportsAnalytics: permissions.includes("reportsAnalytics"),
//     notifications: permissions.includes("notifications"),
//     roleManagement: permissions.includes("roleManagement"),
//   };

//   const newUser = new AdminModel({
//     email,
//     userName,
//     password,
//     phoneNumber,
//     role,
//     branch,
//     permissions: mappedPermissions,
//     parentUserId: _id,
//     createdBy: performedBy,
//   updatedBy: performedBy
//   });

//   await newUser.save();
//   const logs = await logActivity({
//   userId: newUser._id,
//   activity: `Created a new ${role} with username: ${userName}`,
//   performedBy: _id,   // use logged-in user’s id
// });

//   const userObject = newUser.toObject();
//   delete userObject.password;

//   const { accessToken, refreshToken } = await generateTokens(
//     newUser,
//     TypeOfUser.ADMIN
//   );
//   setTokenCookies(res, accessToken, refreshToken);

//   const data = {
//     accessToken,
//     refreshToken,
//     user: userObject,
//     logs
//   };

//   return res
//     .status(statusCode.OK)
//     .json(new ApiResponse(statusCode.OK, data, `created successfully`));
// });
const addAdmins = catchAsyncError(async (req, res, next) => {
  const { email, userName, phoneNumber, branch, role, permissions } = req.body;
  const { _id, performedBy } = req.user;

  const isRoleValid = ["Admin", "SubAdmin"].includes(role);
  if (!isRoleValid) {
    throw new ApiError(statusCode.BAD_REQUEST, `You can add Admin role only`);
  }

  const reqField = [
    "email",
    "userName",
    "phoneNumber",
    "branch",
    "role",
    "permissions",
  ];
  validateRequestBody(reqField, req.body);

  if (typeof permissions !== "object" || Array.isArray(permissions)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Permissions must be an object with boolean values"
    );
  }

  const validPermissions = Object.keys(defaultPermissions);
  const invalidPermissions = Object.keys(permissions).filter(
    (key) => !validPermissions.includes(key)
  );
  if (invalidPermissions.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed values: ${validPermissions.join(", ")}`
    );
  }

  const existingUser = await AdminModel.findOne({
    $or: [{ email }, { phoneNumber }, { userName }],
  });
  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "Admin already exist");
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
  delete userObject.password; // don’t return password in response

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
    .json(new ApiResponse(statusCode.OK, data, `created successfully`));
});
const addSubAdmins = catchAsyncError(async (req, res, next) => {
  const { _id: performedBy, role: loggedInRole, branch: userBranch } = req.user;

  // Joi schema (reportingManager optional here, we'll enforce rules in logic)
  const schema = Joi.object({
    email: Joi.string().email().required(),
    userName: Joi.string().min(3).required(),
    phoneNumber: Joi.string().required(),
    role: Joi.string().valid("Admin", "SubAdmin").required(),
    branch: Joi.string().optional(),
    reportingManager: Joi.string().optional(),
    permissions: Joi.object().optional(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  let {
    email,
    userName,
    phoneNumber,
    role,
    branch,
    reportingManager,
    permissions,
  } = value;

  // 🔑 Rule 1: If Admin is creating a SubAdmin → auto-assign reportingManager from token
  if (loggedInRole === "Admin" && role === "SubAdmin") {
    reportingManager = performedBy;
    branch = userBranch; // Admin can only assign within own branch
  }

  // 🔑 Rule 2: If SuperAdmin is creating Admin/SubAdmin → reportingManager must be provided
  if (loggedInRole === "SuperAdmin") {
    if (!reportingManager) {
      throw new ApiError(
        400,
        "Reporting Manager is required when SuperAdmin creates a user"
      );
    }
  }

  // ❌ Restrict other roles
  if (!["Admin", "SuperAdmin"].includes(loggedInRole)) {
    throw new ApiError(403, "Only Admin or SuperAdmin can create SubAdmin");
  }

  // Check duplicates
  const existingUser = await AdminModel.findOne({
    $or: [{ email }, { phoneNumber }, { userName }],
  });
  if (existingUser) throw new ApiError(400, "User already exists");

  // Default password
  const defaultPassword = "subadmin@123";

  // Create new user
  const adminId = await generateCustomId(EntityCodeEnum.ADMIN, "A");
  const newUser = new AdminModel({
    adminId,
    email,
    userName,
    phoneNumber,
    role,
    branch,
    reportingManager,
    permissions: { ...defaultPermissions, ...permissions },
    parentUserId: performedBy,
    createdBy: performedBy,
    updatedBy: performedBy,
    password: defaultPassword,
  });

  await newUser.save();

  // Log activity
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

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken, user: userObject, logs },
        `${role} created successfully`
      )
    );
});
// ======================|| LOGIN USER ||========================
const loginAdmin = catchAsyncError(async (req, res, next) => {
  const { username, password } = req.body;
  console.log(req.body);

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

  // Optionally include full user object
  // user: userObject,

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
  const loggedInUser = req.user; // ✅ must be set in auth middleware
  if (!loggedInUser) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Unauthorized");
  }

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
      role: user.role,
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

  // Find admin and populate branch + reportingManager
  const admin = await AdminModel.findById(id)
    .populate("branch", "name location")
    .populate("reportingManager", "userName phoneNumber email");

  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "No user found");
  }

  // Get last activity of this admin
  const lastActivity = await UserActivityModel.findOne({ userId: id })
    .sort({ createdAt: -1 })
    .select("activity createdAt -_id");

  // Format response
  const formattedAdmin = {
    _id: admin._id,
    userName: admin.userName,
    email: admin.email,
    phoneNumber: admin.phoneNumber,
    role: admin.role,
    permissions: admin.permissions,
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
          activity: lastActivity.activity,
          time: lastActivity.createdAt,
        }
      : null,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, formattedAdmin, "Data found successfully")
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

  // Optional: You can check if any SuperAdmin already exists if you want to allow only one
  // const existingSuperAdmin = await AdminModel.findOne({ role: "SuperAdmin" });
  // if (existingSuperAdmin) {
  //   throw new ApiError(statusCode.BAD_REQUEST, "A SuperAdmin already exists");
  // }

  // Grant all permissions
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
    password, // Make sure password hashing is handled (middleware or manually)
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
    type: "create", // Type is create since this is a creation action
    performedBy: newUser._id, // The SuperAdmin is creating their own account
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

  // Only allow Admin to update SubAdmin role
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

  // Only SuperAdmin or Admin
  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "Only SuperAdmin or Admin can create coupons"
    );
  }

  // Check if coupon code already exists
  const existingCoupon = await CouponModel.findOne({ couponCode });
  if (existingCoupon) {
    throw new ApiError(statusCode.BAD_REQUEST, "Coupon Code already exists");
  }
  // Trim input strings and parse dates
  const start = new Date(startDate?.trim());
  const expiry = new Date(expiryDate?.trim());

  // Validate parsed dates
  if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid date format");
  }

  // Reset time to start of the day for safe comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  start.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  // Check that start date is not in the past
  if (start < today) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Start date cannot be in the past"
    );
  }

  // Check that expiry date is after start date
  if (expiry <= start) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Expiry date must be after start date"
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
    message: "Coupon created successfully",
    data: newCoupon,
    activityLog,
  });
});

const updateCoupon = catchAsyncError(async (req, res) => {
  const { couponId } = req.params;
  const updateData = req.body;
  const { _id: performedBy, role } = req.user;

  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "Only SuperAdmin or Admin can update coupons"
    );
  }

  const coupon = await CouponModel.findById(couponId);
  if (!coupon) {
    throw new ApiError(statusCode.NOT_FOUND, "Coupon not found");
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
    message: "Coupon updated successfully",
    data: coupon,
    activityLog,
  });
});

const updateCouponStatus = catchAsyncError(async (req, res) => {
  const { couponId } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ApiError(statusCode.BAD_REQUEST, "Status field is required");
  }

  // Find coupon
  const coupon = await CouponModel.findById(couponId);
  if (!coupon) {
    throw new ApiError(statusCode.NOT_FOUND, "Coupon not found");
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
    data: {
      oldStatus,
      newStatus: status,
    },
  });
});
const getAllCoupons = catchAsyncError(async (req, res) => {
  const { _id, role } = req.user;

  if (!["SuperAdmin", "Admin"].includes(role)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "Only SuperAdmin or Admin can view all coupons"
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

  // 🛠 Dynamic pagination with fallback
  page = page ? Math.max(parseInt(page, 10), 1) : 1;
  limit = limit ? Math.max(parseInt(limit, 10), 1) : 12;

  const skip = (page - 1) * limit;

  // 🛠 Sorting (default = createdAt desc)
  sortBy = sortBy || "createdAt";
  order = order === "asc" ? 1 : -1;

  const filter = {};

  // 🔍 Unified search across fields
  if (search) {
    filter.$or = [
      { couponCode: { $regex: search, $options: "i" } },
      { couponName: { $regex: search, $options: "i" } },
      { serviceType: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
    ];
  }

  // ✅ Status filter (All = skip filter)
  if (status && status !== "All") {
    filter.status = status;
  }

  // ✅ ServiceType filter (All = skip filter)
  if (serviceType && serviceType !== "All") {
    filter.serviceType = serviceType;
  }

  // 📅 Date range filter
  if (startDate && endDate) {
    filter.startDate = { $gte: new Date(startDate) };
    filter.expiryDate = { $lte: new Date(endDate) };
  }

  // 📊 Count + Data
  const total = await CouponModel.countDocuments(filter);

  const coupons = await CouponModel.find(filter)
    .sort({ [sortBy]: order }) // recent first by default
    .skip(skip)
    .limit(limit)
    .lean();

  const data = coupons.map((c) => ({
    couponId: c._id,
    couponName: c.couponName,
    header: c.header,
    couponCode: c.couponCode,
    serviceType: c.serviceType,
    discount:
      c.discountType === "Percentage"
        ? `${c.discountPercentage}%`
        : `₹${c.discountAmount}`,
    startDate: c.startDate,
    expiryDate: c.expiryDate,
    status: c.status,
  }));

  if (data.length === 0) {
    return res.status(200).json({
      success: true,
      total: 0,
      page,
      limit,
      totalPages: 0,
      message: "No coupons found",
      data: [],
    });
  }
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

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Build filter
    const filter = { userId };
    if (type) filter.type = type;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start) && !isNaN(end)) {
        filter.createdAt = { $gte: start, $lte: end };
      }
    }

    // Always fetch activities sorted by time (latest first)
    const activities = await UserActivityModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("performedBy", "name email role")
      .lean();

    const total = await UserActivityModel.countDocuments(filter);

    if (!activities.length) {
      return res
        .status(404)
        .json({ success: false, message: "No activities found for this user" });
    }

    const formatActivityTime = (date) => {
      if (!date) return null;
      const now = new Date();
      const daysDiff = differenceInCalendarDays(now, date);

      if (daysDiff === 0)
        return `Today, ${format(date, "hh:mm a")} (${formatDistanceToNowStrict(date)} ago)`;
      if (daysDiff === 1)
        return `Yesterday, ${format(date, "hh:mm a")} (${formatDistanceToNowStrict(date)} ago)`;
      return `${format(date, "eee, dd MMM, hh:mm a")} (${formatDistanceToNowStrict(date)} ago)`;
    };

    const formattedActivities = activities.map((act) => ({
      activity: act.activity,
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

    res.status(200).json({
      success: true,
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
    console.error("Error fetching activities:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error while fetching activities",
    });
  }
};

// const getTransactionHistory = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       sortBy = "createdAt",
//       order = "desc",
//     } = req.query;

//     // Pagination + Sorting
//     const skip = (page - 1) * limit;
//     const sortOrder = order === "desc" ? -1 : 1;

//     // === 1. Transactions with lookups ===
//     const transactions = await Transaction.aggregate([
//       { $sort: { [sortBy]: sortOrder } },
//       { $skip: skip },
//       { $limit: Number(limit) },

//       // Lookup Booking
//       {
//         $lookup: {
//           from: "bookings",
//           localField: "bookingId",
//           foreignField: "_id",
//           as: "booking",
//         },
//       },
//       { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },

//       // Lookup User from Booking
//       {
//         $lookup: {
//           from: "users",
//           localField: "booking.userId",
//           foreignField: "_id",
//           as: "bookingUser",
//         },
//       },
//       { $unwind: { path: "$bookingUser", preserveNullAndEmptyArrays: true } },

//       // Lookup direct userId
//       {
//         $lookup: {
//           from: "users",
//           localField: "userId",
//           foreignField: "_id",
//           as: "directUser",
//         },
//       },
//       { $unwind: { path: "$directUser", preserveNullAndEmptyArrays: true } },

//       // Lookup busOperator
//       {
//         $lookup: {
//           from: "busoperators",
//           localField: "busOperatorId",
//           foreignField: "_id",
//           as: "busOperator",
//         },
//       },
//       { $unwind: { path: "$busOperator", preserveNullAndEmptyArrays: true } },

//       // Lookup hotelManager
//       {
//         $lookup: {
//           from: "hotelmanagers",
//           localField: "hotelManagerId",
//           foreignField: "_id",
//           as: "hotelManager",
//         },
//       },
//       { $unwind: { path: "$hotelManager", preserveNullAndEmptyArrays: true } },

//       // Lookup admin
//       {
//         $lookup: {
//           from: "admins",
//           localField: "adminId",
//           foreignField: "_id",
//           as: "admin",
//         },
//       },
//       { $unwind: { path: "$admin", preserveNullAndEmptyArrays: true } },

//       // Lookup driver
//       {
//         $lookup: {
//           from: "drivers",
//           localField: "driverId",
//           foreignField: "_id",
//           as: "driver",
//         },
//       },
//       { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },

//       // === Final projection ===
//       {
//         $project: {
//           transactionId: 1,
//           type: 1,
//           amount: 1,
//           createdAt: 1,
//           status: 1,
//           description: 1,

//           // Priority for user name:
//           user: {
//             $ifNull: [
//               "$directUser.fullName",
//               {
//                 $ifNull: [
//                   "$busOperator.name",
//                   {
//                     $ifNull: [
//                       "$hotelManager.fullName",
//                       {
//                         $ifNull: [
//                           "$hotelManager.name",
//                           {
//                             $ifNull: [
//                               "$admin.fullName",
//                               {
//                                 $ifNull: [
//                                   "$driver.fullName",
//                                   "$bookingUser.fullName",
//                                 ],
//                               },
//                             ],
//                           },
//                         ],
//                       },
//                     ],
//                   },
//                 ],
//               },
//             ],
//           },
//         },
//       },
//     ]);

//     // === 2. Wallet Stats ===
//     const [totalTransactions, totalCredits, totalDebits, pendingWithdrawals] =
//       await Promise.all([
//         Transaction.countDocuments(),
//         Transaction.aggregate([
//           { $match: { type: "CREDIT", status: "SUCCESS" } },
//           { $group: { _id: null, total: { $sum: "$amount" } } },
//         ]),
//         Transaction.aggregate([
//           { $match: { type: "DEBIT", status: "SUCCESS" } },
//           { $group: { _id: null, total: { $sum: "$amount" } } },
//         ]),
//         Transaction.aggregate([
//           { $match: { type: "DEBIT", status: "PENDING" } },
//           { $group: { _id: null, total: { $sum: "$amount" } } },
//         ]),
//       ]);

//     // === 3. Format transactions ===
//     const formattedTransactions = transactions.map((txn) => ({
//       transactionId: txn.transactionId,
//       user: txn.user || "Unknown",
//       type: txn.type.charAt(0).toUpperCase() + txn.type.slice(1).toLowerCase(),
//       amount: `$${txn.amount.toFixed(2)}`,
//       date: new Date(txn.createdAt).toLocaleDateString("en-US"),
//       status:
//         txn.status === "SUCCESS"
//           ? "Completed"
//           : txn.status.charAt(0).toUpperCase() +
//             txn.status.slice(1).toLowerCase(),
//       description: txn.description || "",
//     }));

//     // === 4. Response ===
//     return res.status(200).json({
//       success: true,
//       message: "Fetched successfully",
//       walletManagement: {
//         totalTransactions,
//         totalCredits: `$${(totalCredits[0]?.total || 0).toFixed(2)}`,
//         totalDebits: `$${(totalDebits[0]?.total || 0).toFixed(2)}`,
//         pendingWithdrawals: `$${(pendingWithdrawals[0]?.total || 0).toFixed(2)}`,
//       },
//       transactionHistory: {
//         page: Number(page),
//         limit: Number(limit),
//         sortBy,
//         order,
//         transactions: formattedTransactions,
//       },
//     });
//   } catch (err) {
//     console.error("Error fetching transactions:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while fetching transactions",
//     });
//   }
// };

const getTransactionHistory = async (req, res) => {
  try {
    // Pagination defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search = "", type = "ALL", status = "ALL" } = req.query;

    const round2 = (n) => Number(Number(n || 0).toFixed(2));

    // Build Mongo query (new model)
    const query = {};

    // Filter by status (SUCCESS / FAILED / ALL)
    if (status && status !== "ALL") {
      query.status = { $regex: new RegExp(`^${status}$`, "i") };
    }

    // Filter by type (CREDIT / DEBIT / ALL) using entries.type
    if (type && type !== "ALL") {
      query.entries = {
        $elemMatch: {
          type: { $regex: new RegExp(`^${type}$`, "i") },
        },
      };
    }

    // Search (transactionId / description / also allow matching entry name)
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { transactionId: regex },
        { description: regex },
        { "entries.name": regex },
      ];
    }

    // Fetch transactions (LIFO)
    const transactions = await TransactionModel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const results = [];

    for (const txn of transactions) {
      // Determine "primary" entry for display (keep old behavior: pick any meaningful one)
      // Prefer USER, else BUS_OPERATOR, HOTEL, DRIVER, ADMIN, else first entry
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

      // Keep the old name/role resolution style (DB lookup), but based on entry entityType
      if (entityType === "USER" && entityId) {
        const user = await UserModel.findById(entityId, "fullName role").lean();
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
        // driverId can be string or ObjectId in Mixed, your driver lookup uses driverId (string)
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
        role,
        type: pickEntry?.type || null,
        amount:
          pickEntry?.amount != null
            ? round2(pickEntry.amount)
            : txn.totalAmount != null
              ? round2(txn.totalAmount)
              : 0,
        date: txn.createdAt,
        status: txn.status,
        description: txn.description,
      });
    }

    // Keep the existing in-memory filtering behavior (transactionId/name/role)
    const filteredResults = results.filter((item) => {
      if (!search) return true;
      const s = String(search).toLowerCase();

      return (
        (item.transactionId || "").toLowerCase().includes(s) ||
        (item.name || "").toLowerCase().includes(s) ||
        (item.role || "").toLowerCase().includes(s)
      );
    });

    // Pagination after search
    const paginatedResults = filteredResults.slice(skip, skip + limit);

    // Total count for pagination (match old response fields)
    const totalRecords = filteredResults.length;
    const totalPages = Math.ceil(totalRecords / limit);

    // Total count from DB query (kept similar to your original variable naming)
    const total = await TransactionModel.countDocuments(query);

    // creditTotal / debitTotal based on ledger entries (SUCCESS only)
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

    // Keep same response structure as your old API
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
};
