const { add } = require("winston");
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
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");

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
    $or: [{ email }, { phoneNumber }],
  });

  if (existingUser) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "User already exist with email or phonenumber"
    );
  }

  const parentOperator = await BusOperatorModel.findById(_id);
  if (!parentOperator) {
    throw new ApiError(statusCode.NOT_FOUND, "Parent bus operator not found");
  }

  const mappedPermissions = {
    busManagement: permissions.includes("busManagement"),
    dashboardManagement: permissions.includes("dashboardManagement"),
    routeManagement: permissions.includes("routeManagement"),
    driverManagement: permissions.includes("driverManagement"),
    ticketManagement: permissions.includes("ticketManagement"),
    walletManagement: permissions.includes("walletManagement"),
  };
  const operatorId = await generateCustomId(EntityCodeEnum.BUS_MEMBER, "BO");

  const newMember = new BusOperatorModel({
    operatorId,
    fullName,
    phoneNumber,
    email,
    idNumber,
    companyName: parentOperator.companyName,
    companyAddress: parentOperator.companyAddress,
    dob,
    password,
    role: "bus-operator-member",
    authorities: { busOperatorAuthorities: permissions },
    parentUserId: _id,
    createdBy: _id,
    verificationStatus: "approved",
    permissions: mappedPermissions,
    branch: parentOperator.branch,

  });

  // Save the member and assign to a variable
  const savedMember = await newMember.save();

  if (!savedMember) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Error occurred while creating the member"
    );
  }

  // Populate parent info and branch
  await savedMember.populate({
    path: "parentUserId",
    select: "fullName companyName branch email phoneNumber",
    populate: { path: "branch", select: "name address" },
  });

  res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      { newMember: savedMember },
      "Member added successfully"
    )
  );
});

// =====================|| UPDATE BUS MEMBER UNDER BUS OPERATOR ||===============================
const updateBusMemberUnderBusOperator = catchAsyncError(
  async (req, res, next) => {
    const { id } = req.params;
    const { _id: operatorId, branch: operatorBranch } = req.user;
    const { fullName, phoneNumber, email, idNumber, dob, permissions, branch } = req.body;

    // Validate permissions
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

    // Fetch the member
    const member = await BusOperatorModel.findById(id);
    if (!member) {
      throw new ApiError(statusCode.NOT_FOUND, "Member not found");
    }

    // Only parent operator can update their member
    if (member.parentUserId.toString() !== operatorId.toString()) {
      throw new ApiError(statusCode.FORBIDDEN, "You are not allowed to update this member");
    }

    // Only update branch if provided, otherwise inherit
    const branchToUpdate = branch || operatorBranch;

    // Prepare updated fields
    const updatedFields = {};
    if (fullName) updatedFields.fullName = fullName;
    if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
    if (email) updatedFields.email = email;
    if (idNumber) updatedFields.idNumber = idNumber;
    if (dob) updatedFields.dob = dob;
    if (permissions) {
      updatedFields.authorities = { busOperatorAuthorities: permissions };
      updatedFields.permissions = mappedPermissions;
    }
    updatedFields.branch = branchToUpdate;

    // Update the member
    const updatedMember = await BusOperatorModel.findByIdAndUpdate(
      id,
      updatedFields,
      { new: true }
    );

    res.status(statusCode.OK).json(
      new ApiResponse(statusCode.OK, updatedMember, "Updated successfully")
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
      .select("fullName CompanyName phoneNumber email  idNumber")
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
