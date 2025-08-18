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
const { getFinalPrice } = require("../../../utils/services/prices.services");
const {
  updateAvatarFunc,
  resetPasswordFunc,
  changePasswordFunc,
} = require("../../../utils/services/functions.services");
const bcrypt = require("bcrypt");
const { hash_rounds } = process.env;


// Register Admin
const addAdmins = catchAsyncError(async (req, res, next) => {
  const { email, userName, password, phoneNumber, branch, role, permissions } =
    req.body;
  const { _id } = req.user;

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

  const data = {
    accessToken,
    refreshToken,
    // user: userObject,
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
  return res.status(statusCode.OK).json(response);
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
  return res.status(statusCode.OK).json(response);
});

const getAllAdmins = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skipIndex = (page - 1) * limit;
  const { role } = req.query;

  const query = {
    role: { $in: ["Admin", "SubAdmin"] },
  };

  if (role) {
    query.role = role; // Filter specific role if passed
  }

  const allUsers = await AdminModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skipIndex)
    .select("avatar email phoneNumber userName verificationStatus role")
    .populate("branch");

  const totalUser = await AdminModel.countDocuments(query);

  if (!allUsers || allUsers.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No users found");
  }

  const results = {
    users: allUsers,
    totalPages: Math.ceil(totalUser / limit),
    currentPage: page,
    totalCount: totalUser,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, results, "Data found successfully"));
});

const getAdminById = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const admin = await AdminModel.findById(id);

  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "No user found");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, admin, "Data found successfully"));
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

  return res.status(statusCode.OK).json(result);
});
const changePassword = catchAsyncError(async (req, res, next) => {
  const result = await changePasswordFunc({
    req,
    res,
    reqModel: AdminModel,
  });

  return res.status(statusCode.OK).json(result);
});
const resetPassword = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc({
    req,
    res,
    reqModel: AdminModel,
  });

  return res.status(statusCode.OK).json(result);
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

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      accessToken,
      refreshToken,
      user: userObject,
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
