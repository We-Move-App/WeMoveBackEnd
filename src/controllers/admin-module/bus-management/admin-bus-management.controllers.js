const {
  BusOperatorBankModel,
} = require("../../../models/bus-module/bus-operator-banks/bus-operator-banks.model");
const {
  BusOperatorDocumentModel,
} = require("../../../models/bus-module/bus-operator-documents/bus-operator-document.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  registerUserWithEmailAndPhoneNumber,
} = require("../../../utils/services/functions.services");
const {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const Wallet = require("../../../models/wallet-module/wallets.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const multer = require("../../../utils/uploadFiles/multer");
const moment = require("moment");
const {
  BranchModel,
} = require("../../../models/admin-module/branch/branches.model");
const busModel = require("../../../models/bus-module/buses/buses.model");

const { TypeOfUser } = require("../../../utils/constants/constants");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const generateUniqueCardNumber = require("../../../utils/customId/generateUniqueCardNumber");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");
const walletsModel = require("../../../models/wallet-module/wallets.model");
const { Batch } = require("mongodb");
const mongoose = require("mongoose");

const getAllBusOperators = catchAsyncError(async (req, res, next) => {
  const { filter } = req.query;

  const allowedStatuses = [
    "approved",
    "processing",
    "pending",
    "submitted",
    "rejected",
    "blocked",
  ];
  if (filter && !allowedStatuses.includes(filter)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid filter value. Allowed values are: ${allowedStatuses.join(", ")}`
    );
  }

  if (filter) {
    req.query.verificationStatus = filter;
  }

  let results = await getAllUsersByAdmin({
    req,
    model: BusOperatorModel,
  });

  const dataWithBusCount = await Promise.all(
    results.data.map(async (operator) => {
      const [busCount, wallet] = await Promise.all([
        busModel.countDocuments({ ownerId: operator._id }),
        walletsModel.findOne({ userId: operator._id }).lean(),
      ]);
      return {
        _id: operator._id,
        fullName: operator.fullName,
        batchVerified: operator.batchVerified,
        verifiedBy: operator.verifiedBy,
        batchVerifiedBy: operator.batchVerifiedBy,
        email: operator.email,
        phoneNumber: operator.phoneNumber,
        verificationStatus: operator.verificationStatus,
        avatar: operator.avatar,
        busCount,
        cardNumber: wallet ? wallet.cardNumber : null,
        balance: wallet ? wallet.balance : 0,
      };
    })
  );

  results.data = dataWithBusCount;

  return res.status(statusCode.OK).json(results);
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const result = await getUserByIdByAdmin({
    req,
    userModel: BusOperatorModel,
    userDocsModel: BusOperatorDocumentModel,
    userBankModel: BusOperatorBankModel,
    userAddressModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: BusOperatorModel });

  return res.status(statusCode.OK).json(result);
});

const deleteBusOperatorAccount = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  const [user, userBank, userDocs] = await Promise.all([
    BusOperatorModel.findById(userId),
    BusOperatorBankModel.findOne({ userId }),
    BusOperatorDocumentModel.findOne({ userId }).populate("documentIds"),
  ]);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  // Delete bank document image if exists
  if (userBank?.bankDocs?.public_id) {
    await deleteImageFromAws(userBank.bankDocs.public_id);
  }

  // Delete user avatar
  if (user?.avatar?.public_id) {
    await deleteImageFromAws(user.avatar.public_id);
  }

  // Delete uploaded documents
  if (userDocs?.documentIds?.length > 0) {
    for (const key of userDocs.documentIds) {
      if (key?.file?.public_id) {
        await deleteImageFromAws(key.file.public_id);
      }
      await DocumentsModel.deleteOne({ _id: key._id });
    }
    await BusOperatorDocumentModel.deleteMany({ userId });
  }

  await Promise.all([
    BusOperatorModel.findByIdAndDelete(userId), // Delete user
    BusOperatorBankModel.deleteMany({ userId }), // Delete bank info
  ]);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Deleted Successfully"));
});

const registerBusOperator = catchAsyncError(async (req, res, next) => {
  const {
    basicInfo,
    bankDetails,
    national_identity_card_front,
    national_identity_card_back,
  } = req.body;

  const existingOperator = await BusOperatorModel.findOne({
    $or: [{ email: basicInfo?.email }, { phoneNumber: basicInfo?.phoneNumber }],
  });

  if (existingOperator) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bus operator with this email or phone number already exists"
    );
  }
  if (!basicInfo.branch || !mongoose.Types.ObjectId.isValid(basicInfo.branch)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid or missing branch ID");
  }
  const branchDoc = await BranchModel.findById(basicInfo.branch);

  if (!branchDoc) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
  }
  // Step 1: Set defaults from backend
  const busOperatorId = await generateCustomId(
    EntityCodeEnum.BUS_OPERATOR,
    "BO"
  );
  const busOperatorData = {
    ...basicInfo,
    operatorId: busOperatorId,
    password: "operator@123",
    verificationStatus: "approved",
    termAndCondition: true,
    emailVerified: true,
    phoneNumberVerified: true,
    permissions: {
      busManagement: true,
      dashboardManagement: true,
      routeManagement: true,
      driverManagement: true,
      ticketManagement: true,
      walletManagement: true,
    },
    branch: branchDoc._id,
    role: "bus-operator",
    createdBy: req.user._id,
  };

  // Step 2: Create Bus Operator
  const busOperator = await BusOperatorModel.create(busOperatorData);
  const operatorId = busOperator._id;

  //creating the wallet
  let wallet = await Wallet.findOne({ userId: operatorId });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: operatorId,
      balance: 0,
      currency: process.env.MOMO_CURRENCY,
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  // Step 3: Create Bank Details
  let bankDetailDoc = null;
  if (bankDetails) {
    bankDetailDoc = await BusOperatorBankModel.create({
      ...bankDetails,
      userId: operatorId,
    });
  }

  // Step 4: Upload and Create Document Entries
  const docs = [];

  if (national_identity_card_front) {
    const docFront = await DocumentsModel.create({
      ...national_identity_card_front,
      ownerId: operatorId,
      documentType: "national_identity_card_front",
    });
    docs.push(docFront._id);
  }

  if (national_identity_card_back) {
    const docBack = await DocumentsModel.create({
      ...national_identity_card_back,
      ownerId: operatorId,
      documentType: "national_identity_card_back",
    });
    docs.push(docBack._id);
  }

  // Step 5: Link documents to BusOperatorDocumentModel
  if (docs.length > 0) {
    await BusOperatorDocumentModel.create({
      userId: operatorId,
      documentIds: docs,
    });
  }

  // Step 6: Send response
  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        operator: busOperator,
        bankDetails: bankDetailDoc,
        documentIds: docs,
      },
      "Bus Operator, bank details, and documents created successfully"
    )
  );
});

const updateBusOperator = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;
  const {
    companyName,
    email,
    phoneNumber,
    fullName,
    dob,
    nationality,
    companyAddress,
    nationIdExpiry,
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    isPrimary,
    national_identity_card_front,
    national_identity_card_back,
    avatar,
    bankDocs,
    branch,
  } = req.body;

  // Simple duplicate email/phone check
  if (email || phoneNumber) {
    const existingOperator = await BusOperatorModel.findOne({
      _id: { $ne: userId },
      $or: [
        { email: email?.toLowerCase() },
        { phoneNumber: phoneNumber?.trim() },
      ],
    });

    if (existingOperator) {
      throw new ApiError(
        statusCode.CONFLICT,
        "Email or phone number is already in use by another operator"
      );
    }
  }

  const updateData = {};
  if (email) updateData.email = email.toLowerCase();
  if (phoneNumber) {
    updateData.phoneNumber = Array.isArray(phoneNumber)
      ? phoneNumber.find((num) => !!num)?.trim()
      : phoneNumber.trim();
  }
  if (companyName) updateData.companyName = companyName;
  if (companyAddress) updateData.companyAddress = companyAddress;
  if (fullName) updateData.fullName = fullName;
  if (dob) updateData.dob = dob;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;

  if (branch) {
    const branchDoc = await BranchModel.findById(branch);
    if (!branchDoc) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
    }
    updateData.branch = branchDoc._id;
  }

  const documentPayloads = [
    { key: "national_identity_card_front", data: national_identity_card_front },
    { key: "national_identity_card_back", data: national_identity_card_back },
  ];

  const uploadedDocsInfo = {};
  const newDocIds = [];

  for (const { key, data } of documentPayloads) {
    if (data && data.file?.url) {
      const newDoc = await DocumentsModel.create({
        ...data,
        ownerId: userId,
        documentType: key,
      });

      uploadedDocsInfo[key] = newDoc;
      newDocIds.push(newDoc._id);
    }
  }

  if (newDocIds.length > 0) {
    const existing = await BusOperatorDocumentModel.findOne({ userId });

    if (!existing) {
      await BusOperatorDocumentModel.create({
        userId,
        documentIds: newDocIds,
      });
    } else {
      existing.documentIds = newDocIds;
      await existing.save();
    }
  }

  if (avatar?.url) {
    const existingUser = await BusOperatorModel.findById(userId);
    if (existingUser?.avatar?.public_id) {
      await deleteImageFromAws(existingUser.avatar.public_id);
    }

    updateData.avatar = avatar;
  }

  // Handle bank details
  const findBank = await BusOperatorBankModel.findOne({ userId });
  if (findBank) {
    if (accountNumber && accountNumber !== findBank.accountNumber) {
      const existingAccount = await BusOperatorBankModel.findOne({
        accountNumber,
      });
      if (existingAccount) {
        throw new ApiError(
          statusCode.CONFLICT,
          "This account number is already registered by another user."
        );
      }
    }

    findBank.accountHolderName =
      accountHolderName || findBank.accountHolderName;
    findBank.accountNumber = accountNumber || findBank.accountNumber;
    findBank.bankName = bankName || findBank.bankName;
    findBank.ifscCode = ifscCode || findBank.ifscCode;
    findBank.branchName = branchName || findBank.branchName;
    if (phoneNumber) {
      findBank.phoneNumber = Array.isArray(phoneNumber)
        ? phoneNumber.find((num) => !!num)?.trim()
        : phoneNumber.trim();
    }
    findBank.isPrimary = isPrimary ?? findBank.isPrimary;

    if (bankDocs?.url) {
      if (findBank.bankDocs?.public_id) {
        await deleteImageFromAws(findBank.bankDocs.public_id);
      }

      findBank.bankDocs = bankDocs;
    }

    await findBank.save();
  }

  // Update Bus Operator
  const updatedUser = await BusOperatorModel.findByIdAndUpdate(
    userId,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  ).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        user: updatedUser,
        bankDetails: findBank,
        documents: uploadedDocsInfo,
      },
      "Bus operator profile updated successfully."
    )
  );
});

const getBusBookingDetails = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;

  if (!bookingId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Booking ID is required");
  }

  const booking = await BusBookingModel.findById(bookingId)
    .populate("busId", "busName busRegNumber")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime");

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        booking,
        "Bus operator profile updated successfully."
      )
    );
});

const searchBusOperators = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      companyName,
      verificationStatus,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      ...filters
    } = req.query;

    const query = {};

    if (fullName) query.fullName = { $regex: new RegExp(fullName, "i") };
    if (email) query.email = { $regex: new RegExp(email, "i") };
    if (phoneNumber)
      query.phoneNumber = { $regex: new RegExp(phoneNumber, "i") };
    if (companyName)
      query.companyName = { $regex: new RegExp(companyName, "i") };
    if (verificationStatus)
      query.verificationStatus = {
        $regex: new RegExp(verificationStatus, "i"),
      };

    for (const key in filters) {
      if (!query[key]) {
        query[key] = filters[key];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      BusOperatorModel.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      BusOperatorModel.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllBusBookings = catchAsyncError(async (req, res, next) => {
  let {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "desc",
    search = "",
    status,
    paymentStatus,
    from,
    to,
    createdBy,
  } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  const matchStage = {};
  if (status) matchStage.status = status;
  if (paymentStatus) matchStage.paymentStatus = paymentStatus;
  if (from && from.trim() !== "") matchStage.from = new RegExp(from, "i");
  if (to && to.trim() !== "") matchStage.to = new RegExp(to, "i");
  if (createdBy) matchStage.bookedBy = createdBy;

  const bookingsPipeline = [
    { $match: matchStage },

    // Lookup bus
    {
      $lookup: {
        from: "buses",
        localField: "busId",
        foreignField: "_id",
        as: "bus",
      },
    },
    { $unwind: { path: "$bus", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "busoperators",
        localField: "bus.ownerId",
        foreignField: "_id",
        as: "busOperator",
      },
    },
    { $unwind: { path: "$busOperator", preserveNullAndEmptyArrays: true } },

    // 🔹 Branch filter via BusOperator
    ...(req.user.role !== "SuperAdmin"
      ? [{ $match: { "busOperator.branch": req.user.branch } }]
      : []),

    // Lookup bookedBy (user)
    {
      $lookup: {
        from: "users",
        localField: "bookedBy",
        foreignField: "_id",
        as: "bookedBy",
      },
    },
    { $unwind: { path: "$bookedBy", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "bookedByOperator",
        foreignField: "_id",
        as: "bookedByOperator",
      },
    },
    {
      $unwind: { path: "$bookedByOperator", preserveNullAndEmptyArrays: true },
    },

    // ✅ Unwind passengers so we can search inside
    { $unwind: { path: "$passengers", preserveNullAndEmptyArrays: true } },
  ];

  if (search && search.trim() !== "") {
    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const regex = new RegExp(escapeRegex(search), "i");
    const isDate = !isNaN(Date.parse(search));

    bookingsPipeline.push({
      $match: {
        $or: [
          { "passengers.name": regex },
          { "passengers.contactNumber": regex },
          { "passengers.email": regex },
          { bookingId: regex },
          { paymentStatus: regex },
          { status: regex },
          { "bus.busRegNumber": regex },
          isDate ? { journeyDate: new Date(search) } : null,
        ].filter(Boolean),
      },
    });
  }

  const totalPipeline = [...bookingsPipeline, { $count: "total" }];
  const totalResult = await BusBookingModel.aggregate(totalPipeline);
  const totalBookings = totalResult[0]?.total || 0;

  bookingsPipeline.push({ $sort: { [sortBy]: order === "asc" ? 1 : -1 } });
  bookingsPipeline.push({ $skip: skip }, { $limit: limit });

  const bookings = await BusBookingModel.aggregate(bookingsPipeline);

  if (!bookings.length) {
    return res.status(404).json({
      success: false,
      message: "No bus bookings found",
      total: 0,
      page,
      limit,
      sortBy,
      order,
      data: [],
    });
  }

  return res.status(200).json({
    success: true,
    message: "Bus bookings retrieved successfully",
    total: totalBookings,
    page,
    limit,
    sortBy,
    order,
    data: bookings.map((booking) => ({
      bookingId: booking._id,
      bookId: booking.bookingId,
      busRegNumber: booking.bus?.busRegNumber || "N/A",
      branch: booking.busOperator?.branch || null,
      bookedBy: booking.bookedBy
        ? {
            fullName: booking.bookedBy.fullName,
            email: booking.bookedBy.email,
            phoneNumber: booking.bookedBy.phoneNumber,
          }
        : null,
      from: booking.from,
      to: booking.to,
      journeyDate: booking.journeyDate,
      amount: booking.price || 0,
      finalAmount: booking.finalAmount || booking.price || 0,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      createdAt: booking.createdAt,
      passengers: booking.passengers
        ? [
            {
              name: booking.passengers.name,
              age: booking.passengers.age,
              gender: booking.passengers.gender,
              contactNumber: booking.passengers.contactNumber,
              seatNumber: booking.passengers.seatNumber,
              email: booking.passengers.email,
            },
          ]
        : [],
    })),
  });
});

const searchAllBusBookings = catchAsyncError(async (req, res, next) => {
  const {
    from,
    to,
    busRegNumber,
    passengerName,
    email,
    phone,
    journeyDate,
    paymentStatus,
    sortBy,
    order,
    limit,
    page,
  } = req.query;

  const query = {};

  if (from) {
    query.from = { $regex: from, $options: "i" };
  }

  if (to) {
    query.to = { $regex: to, $options: "i" };
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (journeyDate) {
    const jd = moment.utc(journeyDate, "YYYY-MM-DD", true);
    if (!jd.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid journeyDate format");
    }
    query.journeyDate = {
      $eq: normalizeDate(jd),
    };
  }

  if (passengerName || email || phone) {
    query.passengers = {
      $elemMatch: {},
    };
    if (passengerName) {
      query.passengers.$elemMatch.name = {
        $regex: passengerName,
        $options: "i",
      };
    }
    if (email) {
      query.passengers.$elemMatch.email = { $regex: email, $options: "i" };
    }
    if (phone) {
      query.passengers.$elemMatch.contactNumber = {
        $regex: phone,
        $options: "i",
      };
    }
  }

  const pageNumber = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;
  const sortField = sortBy || "createdAt";
  const sortOrder = order === "desc" ? 1 : -1;

  // Main query with busId filtering to get busRegNumber
  const bookings = await BusBookingModel.find(query)
    .populate({
      path: "busId",
      select: "busRegNumber",
      match: busRegNumber
        ? { busRegNumber: { $regex: busRegNumber, $options: "i" } }
        : {},
    })
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(pageSize);

  const validBookings = bookings.filter((b) => b.busId);

  if (!validBookings.length) {
    throw new ApiError(statusCode.NOT_FOUND, "No bookings found");
  }

  const formattedBookings = validBookings.flatMap((booking) =>
    booking.passengers.map((passenger) => ({
      bookingId: booking._id,
      busRegNumber: booking.busId?.busRegNumber || "N/A",
      customerName: passenger.name,
      phone: passenger.contactNumber,
      email: passenger.email,
      from: booking.from,
      to: booking.to,
      journeyDate: booking.journeyDate,
      amount: booking.price || 0,
      paymentStatus: booking.paymentStatus,
    }))
  );

  const totalBookings = await BusBookingModel.countDocuments(query);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        bookings: formattedBookings,
        totalBookings,
        totalPages: Math.ceil(totalBookings / pageSize),
        currentPage: pageNumber,
      },
      "Bus bookings retrieved successfully"
    )
  );
});

module.exports = {
  registerBusOperator,
  updateBusOperator,
  getAllBusOperators,
  getSingleUser,
  verifyUserProfile,
  deleteBusOperatorAccount,
  searchBusOperators,
  getAllBusBookings,
  getBusBookingDetails,
  searchAllBusBookings,
};
