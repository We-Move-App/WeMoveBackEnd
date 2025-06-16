const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const {
  busOperatorAuthorities,
} = require("../../../utils/constants/constants");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

// =====================|| ADD BUS MEMBER UNDER BUS OPERATOR ||===============================
const addMemberUnderBusOperator = catchAsyncError(async (req, res, next) => {
  const { fullName, phoneNumber, email, idNumber, dob, password, permissions } =
    req.body;
  const { _id } = req.user;
  const reqField = [
    "fullName",
    "phoneNumber",
    "email",
    "idNumber",
    "dob",
    "password",
    "permissions",
  ];
  validateRequestBody(reqField, req.body);

  if (!Array.isArray(permissions) || permissions?.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "permissions required in array");
  }

  const invalidPermissions = permissions.filter(
    (permission) => !busOperatorAuthorities.includes(permission)
  );

  if (invalidPermissions.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed values: ${busOperatorAuthorities.join(", ")}`
    );
  }

  const existingUser = await BusOperatorModel.findOne({
    $or: [{ email: email }, { phoneNumber: phoneNumber }],
  });

  if (existingUser) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "User already exist with email or phonenumber"
    );
  }
  // Map permissions array to object
  const mappedPermissions = {
    busManagement: permissions.includes("busManagement"),
    dashboardManagement: permissions.includes("dashboardManagement"),
    routeManagement: permissions.includes("routeManagement"),
    driverManagement: permissions.includes("driverManagement"),
    ticketManagement: permissions.includes("ticketManagement"),
    walletManagement: permissions.includes("walletManagement"),
  };

  const newMember = new BusOperatorModel({
    fullName,
    phoneNumber,
    email,
    idNumber,
    dob,
    password,
    role: "bus-operator-member",
    authorities: { busOperatorAuthorities: permissions },
    parentUserId: _id,
    verificationStatus: "approved",
    permissions: mappedPermissions,
  });

  await newMember.save();
  if (!newMember) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Error occurred while creating the member"
    );
  }

  res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        { newMember: newMember },
        "Member added successfully"
      )
    );
});

// =====================|| UPDATE BUS MEMBER UNDER BUS OPERATOR ||===============================

const updateBusMemberUnderBusOperator = catchAsyncError(
  async (req, res, next) => {
    const { id } = req.params;

    const { fullName, phoneNumber, email, idNumber, dob, permissions } =
      req.body;

    const invalidPermissions = permissions.filter(
      (permission) => !busOperatorAuthorities.includes(permission)
    );

    if (invalidPermissions.length > 0) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        `Invalid permissions: ${invalidPermissions.join(", ")}. Allowed values: ${busOperatorAuthorities.join(", ")}`
      );
    }

    const mappedPermissions = {
      busManagement: permissions.includes("busManagement"),
      dashboardManagement: permissions.includes("dashboardManagement"),
      routeManagement: permissions.includes("routeManagement"),
      driverManagement: permissions.includes("driverManagement"),
      ticketManagement: permissions.includes("ticketManagement"),
      walletManagement: permissions.includes("walletManagement"),
    };

    const updatedFields = {
      fullName,
      phoneNumber,
      email,
      idNumber,
      dob,
      authorities: { busOperatorAuthorities: permissions },
      permissions: mappedPermissions,
    };

    const updatedUser = await BusOperatorModel.findByIdAndUpdate(
      id,
      updatedFields,
      {
        new: true,
      }
    );

    if (!updatedUser) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }

    res
      .status(statusCode.OK)
      .json(
        new ApiResponse(statusCode.OK, updatedUser, "Updated successfully")
      );
  }
);

// =====================|| GET ALL BUS MEMBER UNDER BUS OPERATOR ||===============================
const getAllMembersUnderBusOperator = catchAsyncError(
  async (req, res, next) => {
    const busOperatorId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const startIndex = (page - 1) * limit;

    const members = await BusOperatorModel.find({ parentUserId: busOperatorId })
      .select("fullName phoneNumber email idNumber")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(startIndex);

    const totaluser = await BusOperatorModel.countDocuments({
      parentUserId: busOperatorId,
    }).exec();

    if (!members.length) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "No members found for this bus operator"
      );
    }
    const results = {
      members,
      totalPages: Math.ceil(totaluser / limit),
      currentPage: page,
      totalCount: totaluser,
    };

    res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          results,
          "Bus members retrieved successfully"
        )
      );
  }
);

// =====================|| GET BUS MEMBER UNDER BUS OPERATOR ||===============================
const getSingleMemberUnderBusOperator = catchAsyncError(
  async (req, res, next) => {
    const busOperatorId = req.user._id;
    const { id } = req.params;
    if (!id) {
      throw new ApiError(statusCode.BAD_REQUEST, "Member ID required");
    }

    const member = await BusOperatorModel.findOne({
      parentUserId: busOperatorId,
      _id: id,
    }).select(
      "fullName email phoneNumber authorities dob idNumber verificationStatus parentUserId"
    );

    if (!member) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "No member found for this bus operator"
      );
    }

    res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          member,
          "Bus members retrieved successfully"
        )
      );
  }
);

// =====================|| DELETE BUS MEMBER UNDER BUS OPERATOR ||===============================
const deleteMembersUnderBusOperator = catchAsyncError(
  async (req, res, next) => {
    const { id } = req.params;
    const busOperatorId = req.user._id;
    if (!id) {
      throw new ApiError(statusCode.BAD_REQUEST, "Member ID required");
    }

    // Fetch the member to check if they belong to the bus operator
    const member = await BusOperatorModel.findOne({
      _id: id,
      parentUserId: busOperatorId,
    });

    if (!member) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "No member found for this bus operator"
      );
    }

    // Delete the member
    await BusOperatorModel.findByIdAndDelete(id);

    res
      .status(statusCode.OK)
      .json(
        new ApiResponse(statusCode.OK, null, "Bus member deleted successfully")
      );
  }
);

module.exports = {
  addMemberUnderBusOperator,
  updateBusMemberUnderBusOperator,
  getAllMembersUnderBusOperator,
  getSingleMemberUnderBusOperator,
  deleteMembersUnderBusOperator,
};
