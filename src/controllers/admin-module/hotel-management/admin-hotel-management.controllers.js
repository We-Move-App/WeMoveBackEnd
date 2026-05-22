const express = require("express");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const statusCode = require("../../../utils/constants/statusCode");
const {
  HotelManagerBankModel,
} = require("../../../models/hotel-module/hotel-manager-banks/hotel-manager-banks.model");
const {
  HotelManagerDocumentModel,
} = require("../../../models/hotel-module/hotel-manager-documents/hotel-manager-documents.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const {
  AddressModel,
} = require("../../../models/global-module/address/address.model");
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const mongoose = require("mongoose");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel = require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const Wallet = require("../../../models/wallet-module/wallets.model");
const {
  uploadSingleImageToAws,
  uploadMultipleImagesToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const generateUniqueCardNumber = require("../../../utils/customId/generateUniqueCardNumber");
const {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");
const bcrypt = require("bcrypt");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");
const {
  BranchModel,
} = require("../../../models/admin-module/branch/branches.model");
const walletsModel = require("../../../models/wallet-module/wallets.model");
const { translateLn } = require("../../../utils/services/translator.service");

const getAllHotelManagers = catchAsyncError(async (req, res, next) => {
  const { filter } = req.query;

  const allowedStatuses = [
    "approved",
    "processing",
    "pending",
    "submitted",
    "rejected",
    "blocked",
    "p",
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

  const results = await getAllUsersByAdmin({ req, model: HotelManagerModel });

  const ids = results.data.map((u) => u._id);
  if (ids.length === 0) {
    return res.status(statusCode.OK).json(results);
  }

  const wallets = await walletsModel
    .find({ userId: { $in: ids } })
    .select("userId cardNumber balance")
    .lean();

  const walletByUserId = new Map(wallets.map((w) => [String(w.userId), w]));

  const enriched = results.data.map((u) => {
    const w = walletByUserId.get(String(u._id));
    return {
      ...(u.toObject?.() ?? u),
      cardNumber: w ? w.cardNumber : null,
      balance: w ? w.balance : 0,
    };
  });

  results.data = enriched;
  return res.status(statusCode.OK).json(results);
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const result = await getUserByIdByAdmin({
    req,
    userModel: HotelManagerModel,
    userDocsModel: HotelManagerDocumentModel,
    userBankModel: HotelManagerBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: HotelManagerModel });

  return res.status(statusCode.OK).json(result);
});

const getHotelByManagerId = catchAsyncError(async (req, res, next) => {
  const { ownerId } = req.params;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  try {
    const manager = await HotelManagerModel.findById(ownerId)
      .populate("branch", "name location")
      .lean();

    if (!manager) throw new ApiError(404, "Manager not found");

    // 2) Fetch bank info
    const bankAccount = await HotelManagerBankModel.findOne({
      userId: manager._id,
    });

    // 3) Fetch wallet info (optional)
    const wallet = await Wallet.findOne({ userId: manager._id });

    // 4) Fetch hotel info
    const hotel = await Hotel.findOne({ ownerId: manager._id });
    if (!hotel) throw new ApiError(404, "Hotel not found");

    // 5) Fetch hotel images
    const hotelImages = await hotelImagesModel.findOne({ hotelId: hotel._id });

    // 6) Fetch hotel address
    const hotelAddress = await HotelAddressModel.findOne({
      hotelId: hotel._id,
    }).populate("address");

    // 7) Fetch standard & luxury rooms and their images
    const standardRoom = await Room.findOne({
      hotelId: hotel._id,
      roomType: "standard",
    });
    const standardRoomImages = standardRoom
      ? await HotelRoomImagesModel.findOne({ roomId: standardRoom._id })
      : null;

    const luxuryRoom = await Room.findOne({
      hotelId: hotel._id,
      roomType: "luxury",
    });
    const luxuryRoomImages = luxuryRoom
      ? await HotelRoomImagesModel.findOne({ roomId: luxuryRoom._id })
      : null;

    const standardRoomWithImages = standardRoom
      ? { ...standardRoom.toObject(), images: standardRoomImages?.images || [] }
      : null;
    const luxuryRoomWithImages = luxuryRoom
      ? { ...luxuryRoom.toObject(), images: luxuryRoomImages?.images || [] }
      : null;

    // 8) Fetch hotel policy
    const policy = await HotelPolicyModel.findOne({ hotelId: hotel._id });

    // 9) Final response
    res.status(200).json(
      new ApiResponse(
        200,
        {
          manager: {
            ...manager,
            verificationStatus: manager.verificationStatus,
          },
          bankAccount,
          wallet,
          hotel: {
            ...hotel.toObject(),
            address: hotelAddress?.address || null,
            images: hotelImages?.images || [],
          },
          standardRoom: standardRoomWithImages,
          luxuryRoom: luxuryRoomWithImages,
          policy,
        },
        translateLn(ln, "HOTEL_MANAGER_DATA_FETCHED_SUCCESS")
      )
    );
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError(statusCode.INTERNAL_SERVER_ERROR, err.message)
    );
  }
});

const searchHotelManagers = async (req, res) => {
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

    // Add any additional filters passed in query
    for (const key in filters) {
      if (!query[key]) {
        query[key] = filters[key];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      HotelManagerModel.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      HotelManagerModel.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Hotel managers fetched successfully",
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

const registerHotelManagerFromAdmin = catchAsyncError(
  async (req, res, next) => {
    const {
      profileInfo,
      bankInfo,
      hotelInfo,
      addressInfo,
      roomInfo,
      policyInfo,
    } = req.body;
    const adminId = req.user?._id || "system";
    const createdDocs = [];

    try {
      // Validation
      if (
        !profileInfo?.fullName ||
        !profileInfo?.phoneNumber ||
        !profileInfo?.email
      )
        throw new ApiError(
          statusCode.BAD_REQUEST,
          "Profile info is incomplete"
        );

      if (
        !hotelInfo?.hotelName ||
        !hotelInfo?.businessLicense ||
        !hotelInfo?.totalRoom
      )
        throw new ApiError(
          400,
          "Hotel Name, Business License, and Total Room are required"
        );

      const exists = await HotelManagerModel.findOne({
        $or: [
          { email: profileInfo.email.toLowerCase() },
          { phoneNumber: profileInfo.phoneNumber },
        ],
      });
      if (exists)
        throw new ApiError(
          statusCode.BAD_REQUEST,
          "Email or phone already exists"
        );

      const branchDoc = await BranchModel.findById(profileInfo.branch);
      if (!branchDoc) {
        throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
      }

      // Create manager with all verification fields true by default
      const managerId = await generateCustomId(
        EntityCodeEnum.HOTEL_MANAGER,
        "HM"
      );

      const manager = await HotelManagerModel.create({
        ...profileInfo,
        managerId,
        email: profileInfo.email?.toLowerCase(),
        password: "hotelManager@123",
        createdBy: adminId,
        isverified: true,
        verificationStatus: "approved",
        termAndCondition: true,
        emailVerified: true,
        phoneNumberVerified: true,
        branch: branchDoc._id,
      });
      createdDocs.push({ model: HotelManagerModel, id: manager._id });
      // Bank account creation
      let bankAccount = null;

      const cleanBankInfo = { ...(bankInfo || {}) };

      // Clean top-level fields except bankDocs
      Object.keys(cleanBankInfo).forEach((key) => {
        if (
          key !== "bankDocs" &&
          (cleanBankInfo[key] === "" ||
            cleanBankInfo[key] === null ||
            cleanBankInfo[key] === undefined ||
            (typeof cleanBankInfo[key] === "string" &&
              cleanBankInfo[key].trim() === ""))
        ) {
          delete cleanBankInfo[key];
        }
      });

      // Clean nested bankDocs
      if (
        cleanBankInfo.bankDocs &&
        typeof cleanBankInfo.bankDocs === "object"
      ) {
        const docs = { ...cleanBankInfo.bankDocs };

        Object.keys(docs).forEach((key) => {
          if (
            docs[key] === "" ||
            docs[key] === null ||
            docs[key] === undefined ||
            (typeof docs[key] === "string" && docs[key].trim() === "")
          ) {
            delete docs[key];
          }
        });

        // if no valid url, remove whole bankDocs
        if (!docs.url && !docs.fileUrl) {
          delete cleanBankInfo.bankDocs;
        } else {
          cleanBankInfo.bankDocs = {
            public_id: docs.public_id || null,
            url: docs.url || docs.fileUrl,
            fileName: docs.fileName || null,
            fileType: docs.fileType || null,
          };
        }
      }

      // Clean account number
      if (
        !cleanBankInfo.accountNumber ||
        typeof cleanBankInfo.accountNumber !== "string" ||
        cleanBankInfo.accountNumber.trim() === ""
      ) {
        delete cleanBankInfo.accountNumber;
      }

      // Create bank account only if real data exists
      if (
        cleanBankInfo.accountNumber ||
        cleanBankInfo.bankName ||
        cleanBankInfo.accountHolderName ||
        cleanBankInfo.bankDocs
      ) {
        bankAccount = await HotelManagerBankModel.create({
          ...cleanBankInfo,
          userId: manager._id,
          createdBy: adminId,
        });

        createdDocs.push({
          model: HotelManagerBankModel,
          id: bankAccount._id,
        });
      }

      // Wallet
      const wallet = await Wallet.create({
        userId: manager._id,
        balance: 0,
        currency: process.env.MOMO_CURRENCY || "USD",
        cardNumber: await generateUniqueCardNumber(),
        createdBy: adminId,
      });
      createdDocs.push({ model: Wallet, id: wallet._id });

      // Hotel
      const hotel = await Hotel.create({
        ...hotelInfo,
        ownerId: manager._id,
        createdBy: adminId,
      });
      createdDocs.push({ model: Hotel, id: hotel._id });

      // Hotel images
      await hotelImagesModel.create({
        hotelId: hotel._id,
        images: (hotelInfo.hotelImages || []).map((img) =>
          typeof img === "string" ? { url: img } : img
        ),
        uploadedBy: manager._id,
        createdBy: adminId,
      });

      // Address Creation
      const address = await AddressModel.create({
        ...addressInfo,
        createdBy: adminId,
      });
      createdDocs.push({ model: AddressModel, id: address._id });

      // Link Address to Hotel
      await HotelAddressModel.create({
        hotelId: hotel._id,
        address: address._id,
        createdBy: adminId,
      });

      // Validate total rooms count matches sum of standard + luxury
      const totalRoomsFromInput =
        (parseInt(roomInfo.standardRoomCount) || 0) +
        (parseInt(roomInfo.luxuryRoomCount) || 0);
      const hotelTotalRooms = parseInt(hotelInfo.totalRoom);

      if (hotelTotalRooms !== totalRoomsFromInput) {
        throw new ApiError(
          400,
          `Total rooms (${hotelTotalRooms}) must be equal to sum of standard (${roomInfo.standardRoomCount || 0}) and luxury (${roomInfo.luxuryRoomCount || 0}) rooms.`
        );
      }

      // Create Standard Room
      if (!roomInfo.standardRoomCount || !roomInfo.standardRoomPrice) {
        throw new ApiError(400, "Standard room count and price are required");
      }
      const standardRoom = await Room.create({
        hotelId: hotel._id,
        roomType: "standard",
        numberOfRoom: roomInfo.standardRoomCount,
        roomPrice: parseFloat(roomInfo.standardRoomPrice),
        amenities: roomInfo.standardAmenities || [],
        createdBy: adminId,
      });
      createdDocs.push({ model: Room, id: standardRoom._id });

      await HotelRoomImagesModel.create({
        roomId: standardRoom._id,
        roomType: "standard",
        images: (roomInfo.standardImages || []).map((img) =>
          typeof img === "string" ? { url: img } : img
        ),
        uploadedBy: manager._id,
        createdBy: adminId,
      });

      await individualRoom.insertMany(
        Array.from({ length: roomInfo.standardRoomCount }, (_, i) => ({
          roomTypeId: standardRoom._id,
          hotelId: hotel._id,
          roomNumber: `G-${i + 1}`,
          createdBy: adminId,
        }))
      );

      // Create Luxury Room
      const luxuryRoom = await Room.create({
        hotelId: hotel._id,
        roomType: "luxury",
        numberOfRoom: roomInfo.luxuryRoomCount,
        roomPrice: parseFloat(roomInfo.luxuryRoomPrice),
        amenities: roomInfo.luxuryAmenities || [],
        createdBy: adminId,
      });
      createdDocs.push({ model: Room, id: luxuryRoom._id });

      await HotelRoomImagesModel.create({
        roomId: luxuryRoom._id,
        roomType: "luxury",
        images: (roomInfo.luxuryImages || []).map((img) =>
          typeof img === "string" ? { url: img } : img
        ),
        uploadedBy: manager._id,
        createdBy: adminId,
      });

      await individualRoom.insertMany(
        Array.from({ length: roomInfo.luxuryRoomCount }, (_, i) => ({
          roomTypeId: luxuryRoom._id,
          hotelId: hotel._id,
          roomNumber: `T-${i + 1}`,
          createdBy: adminId,
        }))
      );

      // const policy = await HotelPolicyModel.create({
      //   hotelId: hotel._id,
      //   ...policyInfo,
      //   createdBy: adminId
      // });
      // Policy creation
      const policy = await HotelPolicyModel.create({
        hotelId: hotel._id,
        checkInTime: policyInfo.checkInTime,
        checkOutTime: policyInfo.checkOutTime,
        amenities: policyInfo.amenities || [],
        uploadDocuments: (policyInfo.uploadDocuments || []).map((doc) => ({
          name: doc.name, // from payload
          fileUrl: doc.url || doc.fileUrl, // map `url` from upload API to `fileUrl`
          public_id: doc.public_id || null,
          fileName: doc.fileName || null,
          fileType: doc.fileType || null,
        })),
        createdBy: adminId,
      });

      createdDocs.push({ model: HotelPolicyModel, id: policy._id });

      // *** Fetch all related data to send in response ***

      // Hotel with Address populated
      const hotelWithAddress = await Hotel.findById(hotel._id).lean();

      const hotelAddress = await HotelAddressModel.findOne({
        hotelId: hotel._id,
      })
        .populate("address")
        .lean();

      const hotelImages = await hotelImagesModel
        .findOne({ hotelId: hotel._id })
        .lean();

      const standardRoomFull = await Room.findById(standardRoom._id).lean();
      const standardRoomImages = await HotelRoomImagesModel.findOne({
        roomId: standardRoom._id,
      }).lean();

      const luxuryRoomFull = await Room.findById(luxuryRoom._id).lean();
      const luxuryRoomImages = await HotelRoomImagesModel.findOne({
        roomId: luxuryRoom._id,
      }).lean();

      // Build response objects with populated data
      const responseHotel = {
        ...hotelWithAddress,
        address: hotelAddress?.address || null,
        images: hotelImages?.images || [],
      };

      const responseStandardRoom = {
        ...standardRoomFull,
        images: standardRoomImages?.images || [],
      };

      const responseLuxuryRoom = {
        ...luxuryRoomFull,
        images: luxuryRoomImages?.images || [],
      };

      // Final response
      res.status(statusCode.CREATED).json(
        new ApiResponse(
          statusCode.CREATED,
          {
            manager,
            bankAccount,
            wallet,
            hotel: responseHotel,
            standardRoom: responseStandardRoom,
            luxuryRoom: responseLuxuryRoom,
            policy,
          },
          "Hotel Manager & related data created successfully"
        )
      );
    } catch (err) {
      // Manual rollback
      for (const doc of createdDocs.reverse()) {
        try {
          await doc.model.findByIdAndDelete(doc.id);
        } catch (e) {
          console.error("Rollback failed for", doc.model.modelName, doc.id);
        }
      }
      next(
        err instanceof ApiError
          ? err
          : new ApiError(statusCode.INTERNAL_SERVER_ERROR, err.message)
      );
    }
  }
);

const updateHotelManagerFromAdmin = catchAsyncError(async (req, res, next) => {
  const { managerId } = req.params;
  const {
    profileInfo,
    bankInfo,
    hotelInfo,
    addressInfo,
    roomInfo,
    policyInfo,
  } = req.body;
  const adminId = req.user?._id || "system";

  try {
    const deletedFields = {};
    const updatedFields = {};

    // 1) Update Hotel Manager
    const existingManager = await HotelManagerModel.findById(managerId);
    if (!existingManager) throw new ApiError(404, "Manager not found");

    const branchDoc = profileInfo?.branch
      ? await BranchModel.findById(profileInfo.branch)
      : null;
    if (profileInfo?.branch && !branchDoc) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
    }
const updateManagerData = {};

if (profileInfo?.fullName) updateManagerData.fullName = profileInfo.fullName;

// Email duplicate check
if (profileInfo?.email) {
  const email = profileInfo.email.toLowerCase();

  const existingEmail = await HotelManagerModel.findOne({
    email: email,
    _id: { $ne: managerId },
  });

  if (existingEmail) {
    throw new ApiError(statusCode.BAD_REQUEST, "Email already exists");
  }

  updateManagerData.email = email;
}

// Phone duplicate check
if (profileInfo?.phoneNumber) {
  const existingPhone = await HotelManagerModel.findOne({
    phoneNumber: profileInfo.phoneNumber,
    _id: { $ne: managerId },
  });

  if (existingPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Phone number already exists");
  }

  updateManagerData.phoneNumber = profileInfo.phoneNumber;
}

if (profileInfo?.companyName)
  updateManagerData.companyName = profileInfo.companyName;
    if (profileInfo?.companyName)
      updateManagerData.companyName = profileInfo.companyName;
    if (profileInfo?.companyAddress)
      updateManagerData.companyAddress = profileInfo.companyAddress;
    if (profileInfo?.businessLicense)
      updateManagerData.businessLicense = profileInfo.businessLicense;
    if (branchDoc) updateManagerData.branch = branchDoc._id;

    // Verified & status
    updateManagerData.isverified = true;
    updateManagerData.emailVerified = true;
    updateManagerData.phoneNumberVerified = true;
    updateManagerData.verificationStatus = "approved";

    // Avatar handling
    if (profileInfo?.avatar?.url) {
      if (existingManager?.avatar?.public_id) {
        await deleteImageFromAws(existingManager.avatar.public_id);
        deletedFields.managerAvatar = existingManager.avatar;
      }
      updateManagerData.avatar = profileInfo.avatar;
      updatedFields.managerAvatar = profileInfo.avatar;
    }

    const manager = await HotelManagerModel.findByIdAndUpdate(
      managerId,
      { ...updateManagerData, updatedBy: adminId },
      { new: true }
    );

    // 2) Update Bank Info

    // 2) Update Bank Info
    let bankAccount = null;

    if (bankInfo && typeof bankInfo === "object") {
      const existingBank = await HotelManagerBankModel.findOne({
        userId: manager._id,
      });

      const cleanBankInfo = { ...(bankInfo || {}) };

      // Clean top-level fields except bankDocs
      Object.keys(cleanBankInfo).forEach((key) => {
        if (
          key !== "bankDocs" &&
          (cleanBankInfo[key] === "" ||
            cleanBankInfo[key] === null ||
            cleanBankInfo[key] === undefined ||
            (typeof cleanBankInfo[key] === "string" &&
              cleanBankInfo[key].trim() === ""))
        ) {
          delete cleanBankInfo[key];
        }
      });

      // Clean nested bankDocs
      if (
        cleanBankInfo.bankDocs &&
        typeof cleanBankInfo.bankDocs === "object"
      ) {
        const docs = { ...cleanBankInfo.bankDocs };

        Object.keys(docs).forEach((key) => {
          if (
            docs[key] === "" ||
            docs[key] === null ||
            docs[key] === undefined ||
            (typeof docs[key] === "string" && docs[key].trim() === "")
          ) {
            delete docs[key];
          }
        });

        // Remove whole bankDocs if no valid url
        if (!docs.url && !docs.fileUrl) {
          delete cleanBankInfo.bankDocs;
        } else {
          cleanBankInfo.bankDocs = {
            public_id: docs.public_id || null,
            url: docs.url || docs.fileUrl,
            fileName: docs.fileName || null,
            fileType: docs.fileType || null,
          };
        }
      }

      // Clean accountNumber
      if (
        cleanBankInfo.accountNumber !== undefined &&
        cleanBankInfo.accountNumber !== null
      ) {
        cleanBankInfo.accountNumber = String(
          cleanBankInfo.accountNumber
        ).trim();

        if (!cleanBankInfo.accountNumber) {
          delete cleanBankInfo.accountNumber;
        }
      }

      // UPDATE existing bank
      if (existingBank) {
        const updateBankData = {
          ...(cleanBankInfo.bankName && {
            bankName: cleanBankInfo.bankName,
          }),

          ...(cleanBankInfo.accountHolderName && {
            accountHolderName: cleanBankInfo.accountHolderName,
          }),

          ...(cleanBankInfo.accountNumber && {
            accountNumber: cleanBankInfo.accountNumber,
          }),

          ...(cleanBankInfo.isPrimary !== undefined && {
            isPrimary: cleanBankInfo.isPrimary,
          }),

          ...(cleanBankInfo.bankDocs && {
            bankDocs: cleanBankInfo.bankDocs,
          }),
        };

        if (Object.keys(updateBankData).length > 0) {
          // Delete old AWS file only if file changed
          if (
            cleanBankInfo.bankDocs &&
            existingBank.bankDocs?.public_id &&
            (cleanBankInfo.bankDocs.public_id !==
              existingBank.bankDocs.public_id ||
              cleanBankInfo.bankDocs.url !== existingBank.bankDocs.url)
          ) {
            await deleteImageFromAws(existingBank.bankDocs.public_id);
          }

          bankAccount = await HotelManagerBankModel.findOneAndUpdate(
            { userId: manager._id },
            {
              ...updateBankData,
              updatedBy: adminId,
            },
            { new: true }
          );
        } else {
          bankAccount = existingBank;
        }
      }

      // CREATE bank if no existing bank
      else if (Object.keys(cleanBankInfo).length > 0) {
        bankAccount = await HotelManagerBankModel.create({
          ...cleanBankInfo,
          userId: manager._id,
          createdBy: adminId,
        });
      }
    }
    // 3) Update Hotel Info
    const existingHotel = await Hotel.findOne({ ownerId: manager._id });
    if (!existingHotel) throw new ApiError(404, "Hotel not found");

    const updateHotelData = {};
    if (hotelInfo?.hotelName) updateHotelData.hotelName = hotelInfo.hotelName;
    if (hotelInfo?.businessLicense)
      updateHotelData.businessLicense = hotelInfo.businessLicense;
    if (hotelInfo?.totalRoom) updateHotelData.totalRoom = hotelInfo.totalRoom;
    if (hotelInfo?.description)
      updateHotelData.description = hotelInfo.description;

    const hotel = await Hotel.findOneAndUpdate(
      { ownerId: manager._id },
      { ...updateHotelData, updatedBy: adminId },
      { new: true }
    );

    // Hotel Images
    if (hotelInfo?.hotelImages?.length) {
      const existingImages = await hotelImagesModel.findOne({
        hotelId: hotel._id,
      });
      if (existingImages?.images?.length)
        deletedFields.hotelImages = existingImages.images;

      const imagesToSave = hotelInfo.hotelImages.map((img) =>
        typeof img === "string" ? { url: img } : img
      );
      await hotelImagesModel.findOneAndUpdate(
        { hotelId: hotel._id },
        { images: imagesToSave, updatedBy: adminId },
        { upsert: true, new: true }
      );
      updatedFields.hotelImages = imagesToSave;
    }

    // 4) Update Address
    if (addressInfo) {
      const hotelAddress = await HotelAddressModel.findOne({
        hotelId: hotel._id,
      });
      if (hotelAddress) {
        await AddressModel.findByIdAndUpdate(
          hotelAddress.address,
          { ...addressInfo, updatedBy: adminId },
          { new: true }
        );
      } else {
        const newAddress = await AddressModel.create({
          ...addressInfo,
          createdBy: adminId,
        });
        await HotelAddressModel.create({
          hotelId: hotel._id,
          address: newAddress._id,
          createdBy: adminId,
        });
      }
    }

    // 5) Update Rooms
    const updateRoom = async (type, count, price, amenities, images) => {
      const roomUpdate = {};
      if (count !== undefined) roomUpdate.numberOfRoom = count;
      if (price !== undefined) roomUpdate.roomPrice = parseFloat(price);
      if (amenities)
        roomUpdate.amenities = amenities.map((a) => ({
          name: a.name,
          status: a.status,
        }));
      roomUpdate.updatedBy = adminId;

      const room = await Room.findOneAndUpdate(
        { hotelId: hotel._id, roomType: type },
        roomUpdate,
        { new: true }
      );
      if (images?.length) {
        const existingRoomImages = await HotelRoomImagesModel.findOne({
          roomId: room._id,
        });
        if (existingRoomImages?.images?.length)
          deletedFields[`${type}RoomImages`] = existingRoomImages.images;

        const newImages = images.map((img) =>
          typeof img === "string" ? { url: img } : img
        );
        await HotelRoomImagesModel.findOneAndUpdate(
          { roomId: room._id },
          { images: newImages, updatedBy: adminId },
          { upsert: true, new: true }
        );
        updatedFields[`${type}RoomImages`] = newImages;
      }
    };

    if (roomInfo) {
      await updateRoom(
        "standard",
        roomInfo.standardRoomCount,
        roomInfo.standardRoomPrice,
        roomInfo.standardAmenities,
        roomInfo.standardImages
      );
      await updateRoom(
        "luxury",
        roomInfo.luxuryRoomCount,
        roomInfo.luxuryRoomPrice,
        roomInfo.luxuryAmenities,
        roomInfo.luxuryImages
      );
    }

    // 6) Update Policy
    if (policyInfo) {
      const existingPolicy = await HotelPolicyModel.findOne({
        hotelId: hotel._id,
      });
      const updatePolicyData = {};
      if (policyInfo?.checkInTime)
        updatePolicyData.checkInTime = policyInfo.checkInTime;
      if (policyInfo?.checkOutTime)
        updatePolicyData.checkOutTime = policyInfo.checkOutTime;
      if (policyInfo?.amenities)
        updatePolicyData.amenities = policyInfo.amenities.map((a) => ({
          name: a.name,
          status: a.status,
        }));

      if (policyInfo?.uploadDocuments?.length) {
        if (existingPolicy?.uploadDocuments?.length)
          deletedFields.policyDocs = existingPolicy.uploadDocuments;
        updatePolicyData.uploadDocuments = policyInfo.uploadDocuments;
        updatedFields.policyDocs = policyInfo.uploadDocuments;
      }

      await HotelPolicyModel.findOneAndUpdate(
        { hotelId: hotel._id },
        { ...updatePolicyData, updatedBy: adminId },
        { new: true, upsert: true }
      );
    }

    // 7) Prepare final response
    const updatedHotelAddress = await HotelAddressModel.findOne({
      hotelId: hotel._id,
    }).populate("address");
    const updatedHotelImages = await hotelImagesModel.findOne({
      hotelId: hotel._id,
    });
    const updatedStandardRoom = await Room.findOne({
      hotelId: hotel._id,
      roomType: "standard",
    });
    const updatedStandardRoomImages = await HotelRoomImagesModel.findOne({
      roomId: updatedStandardRoom._id,
    });
    const updatedLuxuryRoom = await Room.findOne({
      hotelId: hotel._id,
      roomType: "luxury",
    });
    const updatedLuxuryRoomImages = await HotelRoomImagesModel.findOne({
      roomId: updatedLuxuryRoom._id,
    });
    const policy = await HotelPolicyModel.findOne({ hotelId: hotel._id });

    const standardRoomWithImages = {
      ...updatedStandardRoom.toObject(),
      images: updatedStandardRoomImages?.images || [],
    };
    const luxuryRoomWithImages = {
      ...updatedLuxuryRoom.toObject(),
      images: updatedLuxuryRoomImages?.images || [],
    };

    res.status(200).json(
      new ApiResponse(
        200,
        {
          manager,
          bankAccount,
          wallet: await Wallet.findOne({ userId: manager._id }),
          hotel: {
            ...hotel.toObject(),
            address: updatedHotelAddress?.address || null,
            images: updatedHotelImages?.images || [],
          },
          standardRoom: standardRoomWithImages,
          luxuryRoom: luxuryRoomWithImages,
          policy,
          updatedFields,
          deletedFields,
        },
        "Hotel Manager & related data updated successfully"
      )
    );
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError(statusCode.INTERNAL_SERVER_ERROR, err.message)
    );
  }
});

const getAllHotelBookings = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    let query = {};

    // 🔹 Branch restriction (except SuperAdmin)
    if (req.user.role !== "SuperAdmin") {
      // 1. Find all hotel managers in this branch
      const managers = await HotelManagerModel.find(
        { branch: req.user.branch },
        { _id: 1 }
      ).lean();

      const managerIds = managers.map((m) => m._id);

      // 2. Find all hotels owned by these managers
      const hotels = await Hotel.find(
        { ownerId: { $in: managerIds } },
        { _id: 1 }
      ).lean();

      const hotelIds = hotels.map((h) => h._id);

      // 3. Restrict bookings to only those hotelIds
      query.hotelId = { $in: hotelIds };
    }

    // 🔎 Search filter
    if (search) {
      const regex = new RegExp(search, "i");
      const isValidObjectId = mongoose.Types.ObjectId.isValid(search);
      const date = !isNaN(Date.parse(search)) ? new Date(search) : null;
      let dateRange = null;

      if (date) {
        const start = new Date(date);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        dateRange = { $gte: start, $lte: end };
      }

      query.$or = [
        { status: regex },
        { "user.name": regex },
        { "user.phoneNumber": regex },
        { "user.email": regex },
      ];

      if (isValidObjectId) {
        query.$or.push({ _id: search }, { hotelId: search });
      }

      if (dateRange) {
        query.$or.push({ checkInDate: dateRange }, { checkOutDate: dateRange });
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [bookings, total] = await Promise.all([
      HotelBookingModel.find(query)
        .select(
          "hotelId bookingId checkInDate checkOutDate totalAmount status user createdAt"
        )
        .populate("hotelId", "hotelName")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      HotelBookingModel.countDocuments(query),
    ]);

    const formattedBookings = bookings.map((b) => ({
      bookingId: b._id,
      bookId: b.bookingId,
      hotelId: b.hotelId?._id || null,
      hotelName: b.hotelId?.hotelName || null,
      customerName: b.user?.[0]?.name || null,
      phone: b.user?.[0]?.phoneNumber || null,
      email: b.user?.[0]?.email || null,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      amount: b.totalAmount,
      status: b.status,
    }));

    return res.status(200).json({
      success: true,
      message: "Hotel bookings fetched successfully",
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order: sortOrder,
      data: formattedBookings,
    });
  } catch (error) {
    console.error("Error fetching hotel bookings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getBookingDetailsById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const booking = await HotelBookingModel.findById(bookingId)
      .populate("hotelId", "_id")
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const responseData = {
      bookingDetails: {
        bookingId: booking._id,
        bookID: booking.bookingId,
        status: booking.status,
        hotelId: booking.hotelId?._id || null,
        amount: `$${booking.totalAmount.toFixed(2)}`,
      },
      customerInformation: {
        name: booking.user?.[0]?.name || null,
        phone: booking.user?.[0]?.phoneNumber || null,
        email: booking.user?.[0]?.email || null,
      },
      stayDetails: {
        checkInDate: booking.checkInDate?.toISOString().split("T")[0] || null,
        checkOutDate: booking.checkOutDate?.toISOString().split("T")[0] || null,
      },
    };

    res.status(200).json({
      success: true,
      message: "Booking details fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching booking details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const searchHotelBookings = async (req, res) => {
  try {
    let {
      bookingId,
      hotelId,
      customerName,
      phone,
      email,
      checkInDate,
      checkOutDate,
      status,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Search by bookingId
    if (bookingId) {
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }
      query._id = bookingId;
    }

    // Search by hotelId
    if (hotelId) {
      if (!mongoose.Types.ObjectId.isValid(hotelId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hotel ID",
        });
      }
      query.hotelId = hotelId;
    }

    // Search by customer name
    if (customerName) {
      query["user.name"] = { $regex: new RegExp(customerName, "i") };
    }

    // Search by phone
    if (phone) {
      query["user.phoneNumber"] = { $regex: new RegExp(phone, "i") };
    }

    // Search by email
    if (email) {
      query["user.email"] = { $regex: new RegExp(email, "i") };
    }

    // Search by check-in date
    if (checkInDate) {
      const checkInStart = new Date(checkInDate);
      const checkInEnd = new Date(checkInDate);
      checkInEnd.setHours(23, 59, 59, 999);
      query.checkInDate = { $gte: checkInStart, $lte: checkInEnd };
    }

    // Search by check-out date
    if (checkOutDate) {
      const checkOutStart = new Date(checkOutDate);
      const checkOutEnd = new Date(checkOutDate);
      checkOutEnd.setHours(23, 59, 59, 999);
      query.checkOutDate = { $gte: checkOutStart, $lte: checkOutEnd };
    }

    // Search by status
    if (status) {
      query.status = { $regex: new RegExp(status, "i") };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [bookings, total] = await Promise.all([
      HotelBookingModel.find(query)
        .populate("hotelId", "_id")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      HotelBookingModel.countDocuments(query),
    ]);

    const formattedBookings = bookings.map((b) => ({
      bookingId: b._id,
      hotelId: b.hotelId?._id || null,
      customerName: b.user?.[0]?.name || null,
      phone: b.user?.[0]?.phoneNumber || null,
      email: b.user?.[0]?.email || null,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      amount: b.totalAmount,
      status: b.status,
    }));

    if (formattedBookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Hotel bookings fetched successfully",
      data: {
        bookings: formattedBookings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error searching bookings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerHotelManagerFromAdmin,
  updateHotelManagerFromAdmin,
  getHotelByManagerId,
  getAllHotelManagers,
  getSingleUser,
  verifyUserProfile,
  searchHotelManagers,
  getAllHotelBookings,
  getBookingDetailsById,
  searchHotelBookings,
};
