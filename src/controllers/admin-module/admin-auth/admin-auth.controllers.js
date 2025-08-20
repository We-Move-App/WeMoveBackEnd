const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
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
const AdminDeviceTokenModel = require("../../../models/admin-module/admin-device-tokens/admin-device-tokens.model");
const {
  TypeOfUser,
  adminAuthorities,
} = require("../../../utils/constants/constants");

const{ logActivity} = require("../../../utils/ActivityLog/ActivityLog")
const { getFinalPrice } = require("../../../utils/services/prices.services");
const {
  updateAvatarFunc,
  resetPasswordFunc,
  changePasswordFunc,
} = require("../../../utils/services/functions.services");
const bcrypt = require("bcrypt");
const { hash_rounds } = process.env;
const {
  busOperatorAuthorities,
} = require("../../../utils/constants/constants");
const BranchModel = require("../../../models/admin-module/branch/branches.model")
// Register Admin
const addAdmins = catchAsyncError(async (req, res, next) => {

  const { email, userName, password, phoneNumber, branch, role, permissions } =
    req.body;
  const { _id } = req.user;
console.log(_id)

  const isRoleValid = ["Admin", "SubAdmin"].includes(role);

  if (!isRoleValid) {
    throw new ApiError(statusCode.BAD_REQUEST, `You can add Admin role only`);
  }
  const reqField = [
    "email",
    "userName",
    "password",
    "phoneNumber",
    "branch",
    "role",
    "permissions",
  ];

  validateRequestBody(reqField, req.body);

  if (!Array.isArray(permissions) || permissions?.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "permissions required in array");
  }

  const invalidPermissions = permissions.filter(
    (permission) => !adminAuthorities.includes(permission)
  );

  if (invalidPermissions.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed values: ${busOperatorAuthorities.join(", ")}`
    );
  }

  const existingUser = await AdminModel.findOne({
    $or: [
      { email: email },
      { phoneNumber: phoneNumber },
      { userName: userName },
    ],
  });

  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "Admin already exist");
  }

  // Map permissions array to object
  const mappedPermissions = {
    userManagement: permissions.includes("userManagement"),
    busManagement: permissions.includes("busManagement"),
    driverManagement: permissions.includes("driverManagement"),
    hotelManagement: permissions.includes("hotelManagement"),
    walletManagement: permissions.includes("walletManagement"),
    reportsAnalytics: permissions.includes("reportsAnalytics"),
    notifications: permissions.includes("notifications"),
    roleManagement: permissions.includes("roleManagement"),
  };

  const newUser = new AdminModel({
    email,
    userName,
    password,
    phoneNumber,
    role,
    branch,
    permissions: mappedPermissions,
    parentUserId: _id,
  });

  await newUser.save();
  // ActivityModel
    const logs =  await logActivity(_id, `Created a new ${role} with username: ${userName}`);

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
    logs
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, `Admin created successfully`));
});

// Register Sub Admin
const addSubAdmins = catchAsyncError(async (req, res, next) => {
  const { email, userName, role, password, phoneNumber, branch } = req.body;

  const reqField = ["email", "userName", "password", "phoneNumber", "branch"];
  validateRequestBody(reqField, req.body);

  const existingUser = await AdminModel.findOne({
    $or: [
      { email: email },
      { phoneNumber: phoneNumber },
      { userName: userName },
    ],
  });

  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "Admin already exist");
  }

  const newUser = new AdminModel({
    email,
    userName,
    password,
    phoneNumber,
    role,
    branch,
  });
a
  await newUser.save();
  
 const logsUser =   await logActivity(_id, `Created a new ${role} with username: ${userName}`);
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
    logsUser
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, `Admin created successfully`));
});

// ======================|| LOGIN USER ||========================
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





 const activityLog = await logActivity(existingUser._id, "Logged in successfully");

const data = {
  accessToken,
  refreshToken,
  UserActivity: activityLog
};


  // Optionally include full user object
  // user: userObject,


return res
  .status(statusCode.OK)
  .json(new ApiResponse(statusCode.OK, data, `Login Successfully`));})

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
  const userActivity = await logActivity(
    req.user._id,
    `Saved device token for ${deviceType}`
  );

  // Build final response
  const data = {
    result: response,
    UserActivity: userActivity
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, "Device token saved successfully"));
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
  const userActivity = await logActivity(
    req.user._id,
    `Removed device token for ${deviceType}`
  );

  // Build final response
  const data = {
    result: response,
    UserActivity: userActivity
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, "Device token removed successfully"));
});
const getAllAdmins = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skipIndex = (page - 1) * limit;
  const { role } = req.query;

  const query = { role: { $in: ["Admin", "SubAdmin"] } };
  if (role) query.role = role;

  const allUsers = await AdminModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skipIndex)
    .populate("branch", "name location createdAt"); 

  const totalUser = await AdminModel.countDocuments(query);

  if (!allUsers || allUsers.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No users found");
  }

  const users = allUsers.map((user) => {
    let truePermissionCount = 0;

    if (Array.isArray(user.permissions)) {
      // if it's an array of booleans or objects
      truePermissionCount = user.permissions.filter(
        (perm) => perm === true || (typeof perm === "object" && Object.values(perm).some(Boolean))
      ).length;
    } else if (typeof user.permissions === "object" && user.permissions !== null) {
      // if it's a plain object like {create: true, edit: false}
      truePermissionCount = Object.values(user.permissions).filter(Boolean).length;
    }

    return {
      name: user.userName,
      email: user.email,
      role: user.role,
      permissionsCount: truePermissionCount,
      createdAt: user.createdAt,
      branch: user.branch
        ? {
            name: user.branch.name,
            location: user.branch.location,
            createdAt: user.branch.createdAt,
          }
        : null,
    };
  });

  const results = {
    data: {
      users,
      pagination: {
        totalPages: Math.ceil(totalUser / limit),
        currentPage: page,
        totalCount: totalUser,
      },
    },
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, results.data, "Data found successfully"));
});
const { UserActivityModel } = require("../../../models/admin-module/ActivityModel/ActivityModel");

const getAdminById = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const admin = await AdminModel.findById(id).populate(
    "branch",
    "name location coordinates"
  );

  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "No user found");
  }

  // Fetch the latest activity of this admin
  const lastActivity = await UserActivityModel.findOne({ userId: id })
    .sort({ createdAt: -1 })
    .select("activity createdAt -_id");

  // Format response
  const formattedAdmin = {
    _id: admin._id,
    userName: admin.userName,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
    branch: admin.branch
      ? {
          name: admin.branch.name || null,
          location: admin.branch.location || null,
          coordinates: admin.branch.coordinates || { latitude: null, longitude: null },
        }
      : { name: null, location: null, coordinates: { latitude: null, longitude: null } },
    UserActivity: lastActivity
      ? {
          activity: lastActivity.activity,
          time: lastActivity.createdAt, // you can format date here if needed
        }
      : null,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, formattedAdmin, "Data found successfully"));
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

const updateAvatar = catchAsyncError(async (req, res, next) => {
  const result = await updateAvatarFunc({
    req,
    res,
    reqModel: AdminModel,
  });
  const activityLog = await logActivity(req.user._id, "Updated profile avatar");

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
  const activityLog = await logActivity(req.user._id, "Changed password");

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

  const activityLog = await logActivity(req.user._id, "Reset password");

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
    $or: [
      { email },
      { phoneNumber },
      { userName },
    ],
  });

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
   const activityLog = await logActivity(
    newUser._id,
    "SuperAdmin account created"
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      accessToken,
      refreshToken,
      user: userObject,
      userActivity: activityLog
    }, "SuperAdmin created successfully")
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
  updateAvatar,
  changePassword,
  resetPassword,
  createSuperAdmin: addSuperAdmin,
};
