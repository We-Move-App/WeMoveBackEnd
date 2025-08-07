const {
  BusOperatorBankModel,
} = require("../../../models/bus-module/bus-operator-banks/bus-operator-banks.model");
const {
  BusOperatorDocumentModel,
} = require("../../../models/bus-module/bus-operator-documents/bus-operator-document.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const { DocumentsModel } = require("../../../models/global-module/documents/document.model");
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
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const multer = require("../../../utils/uploadFiles/multer");

const { TypeOfUser } = require("../../../utils/constants/constants");
const getAllBusOperators = catchAsyncError(async (req, res, next) => {



  const results = await getAllUsersByAdmin({ req, model: BusOperatorModel });

  return res.status(statusCode.OK).json(results);
});
const { validateRequestBody } = require("../../../utils/reqFunctions/reqFunction");

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

  // 🔥 Missing deletions — add these:
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
  } = req.body;

  const docsToUpload = req.files || {};
  const keys = Object.keys(docsToUpload);

  // ✅ Check email before calling .toLowerCase()
  if (!email || typeof email !== 'string') {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Email is required and must be a valid string."
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ✅ Now it's safe to check if user already exists
  const existingUser = await BusOperatorModel.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(statusCode.CONFLICT, "User already exists with this email.");
  }

  const userData = {
    companyName,
    email: normalizedEmail,
    phoneNumber: Array.isArray(phoneNumber)
      ? phoneNumber.find((num) => !!num)?.trim()
      : phoneNumber?.trim(),
    fullName,
    dob,
    nationality,
    companyAddress,
    nationIdExpiry,
  };


  // ➤ Handle avatar upload
  if (docsToUpload["avatar"]) {
    const imgFile = docsToUpload["avatar"][0];
    const cloudImage = await uploadImageOnAws(imgFile.path);
    if (!cloudImage?.public_id || !cloudImage?.secure_url) {
      throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, `Avatar upload failed`);
    }
    userData.avatar = {
      public_id: cloudImage.public_id,
      url: cloudImage.secure_url,
    };
  }

  // ➤ Create user
  const newUser = await BusOperatorModel.create(userData);

  // ➤ Handle documents
  const validDocumentTypes = ["national_identity_card_front", "national_identity_card_back"];
  const invalidKeys = keys.filter(
    (key) => !validDocumentTypes.includes(key) && key !== "avatar" && key !== "bank_detail"
  );

  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  let docsIds = [];

  for (const key of validDocumentTypes) {
    if (docsToUpload[key]) {
      const imgFile = docsToUpload[key][0];
      const cloudImage = await uploadImageOnAws(imgFile.path);

      if (!cloudImage?.public_id || !cloudImage?.secure_url) {
        throw new ApiError(
          statusCode.INTERNAL_SERVER_ERROR,
          `Image upload failed for document ${key}`
        );
      }

      const uploadedDoc = await DocumentsModel.create({
        documentName: key,
        documentType: key,
        file: {
          public_id: cloudImage.public_id,
          url: cloudImage.secure_url,
        },
        fileType: imgFile.mimetype,
        ownerId: req.user?._id,
      });

      docsIds.push(uploadedDoc._id);
    }
  }

  if (docsIds.length > 0) {
    await BusOperatorDocumentModel.create({
      userId: newUser._id,
      documentIds: docsIds,
    });
  }

  // ➤ Handle bank details
  if (accountNumber) {
    const existingAccount = await BusOperatorBankModel.findOne({ accountNumber });
    if (existingAccount) {
      throw new ApiError(
        statusCode.CONFLICT,
        "This account number is already registered by another user."
      );
    }

    const bankData = {
      userId: newUser._id,
      accountHolderName,
      accountNumber,
      bankName,
      ifscCode,
      branchName,
      phoneNumber: Array.isArray(phoneNumber)
        ? phoneNumber.find((num) => !!num)?.trim()
        : phoneNumber?.trim(),
      isPrimary: isPrimary ?? false,
    };

    // ➤ Handle bank document upload
    if (docsToUpload["bank_detail"]) {
      const imgFile = docsToUpload["bank_detail"][0];
      const cloudImage = await uploadImageOnAws(imgFile.path);

      if (!cloudImage?.public_id || !cloudImage?.secure_url) {
        throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "Bank document upload failed");
      }

      bankData.bankDocs = {
        public_id: cloudImage.public_id,
        url: cloudImage.secure_url,
      };
    }

    await BusOperatorBankModel.create(bankData);
  }

  const finalDocs = await BusOperatorDocumentModel.findOne({ userId: newUser._id }).populate("documentIds");
  const finalBank = await BusOperatorBankModel.findOne({ userId: newUser._id });

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        user: newUser,
        bankDetails: finalBank,
        documents: finalDocs || null,
      },
      "Bus operator created successfully."
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
  } = req.body;

  const docsToUpload = req.files || {};
  const keys = Object.keys(docsToUpload);

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

  // ➤ Handle avatar upload
  if (docsToUpload["avatar"]) {
    const imgFile = docsToUpload["avatar"][0];
    const cloudImage = await uploadImageOnAws(imgFile.path);
    if (!cloudImage?.public_id || !cloudImage?.secure_url) {
      throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, `Avatar upload failed`);
    }
    updateData.avatar = {
      public_id: cloudImage.public_id,
      url: cloudImage.secure_url,
    };
  }

  // ➤ Handle documents
  const validDocumentTypes = ["national_identity_card_front", "national_identity_card_back"];
  const invalidKeys = keys.filter(
    (key) => !validDocumentTypes.includes(key) && key !== "avatar" && key !== "bank_detail"
  );

  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  const userDocument = await BusOperatorDocumentModel.findOne({ userId });
  let docsIds = [];

  for (const key of validDocumentTypes) {
    if (docsToUpload[key]) {
      const imgFile = docsToUpload[key][0];
      const cloudImage = await uploadImageOnAws(imgFile.path);

      if (!cloudImage?.public_id || !cloudImage?.secure_url) {
        throw new ApiError(
          statusCode.INTERNAL_SERVER_ERROR,
          `Image upload failed for document ${key}`
        );
      }

      const uploadedDoc = await DocumentsModel.create({
        documentName: key,
        documentType: key,
        file: {
          public_id: cloudImage.public_id,
          url: cloudImage.secure_url,
        },
        fileType: imgFile.mimetype,
        ownerId: req.user?._id,
      });

      docsIds.push(uploadedDoc._id);
    }
  }

  if (docsIds.length > 0) {
    if (!userDocument) {
      await BusOperatorDocumentModel.create({ userId, documentIds: docsIds });
    } else {
      userDocument.documentIds.push(...docsIds);
      await userDocument.save();
    }
  }

  // ➤ Handle bank details
  const findBank = await BusOperatorBankModel.findOne({ userId });
  if (findBank) {
    if (accountNumber && accountNumber !== findBank.accountNumber) {
      const existingAccount = await BusOperatorBankModel.findOne({ accountNumber });
      if (existingAccount) {
        throw new ApiError(
          statusCode.CONFLICT,
          "This account number is already registered by another user."
        );
      }
    }

    findBank.accountHolderName = accountHolderName || findBank.accountHolderName;
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

    // ➤ Handle bank document update
    if (docsToUpload["bank_detail"]) {
      if (findBank.bankDocs?.public_id) {
        await deleteImageFromAws(findBank.bankDocs.public_id);
      }

      const imgFile = docsToUpload["bank_detail"][0];
      const cloudImage = await uploadImageOnAws(imgFile.path);

      if (!cloudImage?.public_id || !cloudImage?.secure_url) {
        throw new ApiError(
          statusCode.INTERNAL_SERVER_ERROR,
          "Bank document upload failed"
        );
      }

      findBank.bankDocs = {
        public_id: cloudImage.public_id,
        url: cloudImage.secure_url,
      };
    }

    await findBank.save();
  }

  // ➤ Update the user
  const updatedUser = await BusOperatorModel.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  // ➤ Optional: Get uploaded documents for response
  const updatedDocs = await BusOperatorDocumentModel.findOne({ userId }).populate("documentIds");

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        user: updatedUser,
        bankDetails: findBank,
        documents: updatedDocs || null, // optional
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
    .populate(
      "busId",
      "busName busRegNumber"
    )
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        booking,
        "Bus booking details retrieved successfully"
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
    if (phoneNumber) query.phoneNumber = { $regex: new RegExp(phoneNumber, "i") };
    if (companyName) query.companyName = { $regex: new RegExp(companyName, "i") };
    if (verificationStatus) query.verificationStatus = { $regex: new RegExp(verificationStatus, "i") };

    for (const key in filters) {
      if (!query[key]) {
        query[key] = filters[key];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      BusOperatorModel.find(query).sort(sortOption).skip(skip).limit(parseInt(limit)),
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
  const {
    date,
    busId,
    routeId,
    sortBy,
    order,
    limit,
    page,
    startDate,
    endDate,
    pickup,
    drop,
  } = req.query;

  const query = {};

  if (startDate) {
    const selectedStartDate = moment.utc(startDate, "YYYY-MM-DD", true);
    if (!selectedStartDate.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid startDate format");
    }
    query.journeyDate = { $gte: normalizeDate(selectedStartDate) };
  }

  if (endDate) {
    const selectedEndDate = moment.utc(endDate, "YYYY-MM-DD", true);
    if (!selectedEndDate.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid endDate format");
    }
    query.journeyDate = {
      ...(query.journeyDate || {}),
      $lte: normalizeDate(selectedEndDate),
    };
  }

  if (pickup) {
    query.from = { $regex: pickup, $options: "i" };
  }

  if (drop) {
    query.to = { $regex: drop, $options: "i" };
  }

  if (routeId) {
    query.routeId = routeId;
  }

  const pageNumber = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;
  const sortField = sortBy || "createdAt";
  const sortOrder = order === "desc" ? 1 : -1;

  const bookings = await BusBookingModel.find(query)
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(pageSize)
    .populate("busId", "busRegNumber");

  if (!bookings || bookings.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No bookings found");
  }

  // Flatten the response for each passenger
  const formattedBookings = bookings.flatMap((booking) =>
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
      query.passengers.$elemMatch.name = { $regex: passengerName, $options: "i" };
    }
    if (email) {
      query.passengers.$elemMatch.email = { $regex: email, $options: "i" };
    }
    if (phone) {
      query.passengers.$elemMatch.contactNumber = { $regex: phone, $options: "i" };
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
      match: busRegNumber ? { busRegNumber: { $regex: busRegNumber, $options: "i" } } : {},
    })
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(pageSize);

  // Filter out bookings where busId is null due to busRegNumber mismatch
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
  getBusBookingDetails,
  updateBusOperator,
  getAllBusOperators,
  getSingleUser,
  verifyUserProfile,
  deleteBusOperatorAccount,
  searchBusOperators,
  getAllBusBookings,
  searchAllBusBookings
};
