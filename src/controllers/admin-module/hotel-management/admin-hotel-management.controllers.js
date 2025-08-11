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
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model")
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const mongoose = require("mongoose");
const individualRoomModule = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel= require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const {DocumentsModel} = require("../../../models/global-module/documents/document.model");
const Wallet=require('../../../models/wallet-module/wallets.model')
const { uploadSingleImageToAws } = require("../../../utils/uploadFiles/images/uploadImages");
const generateUniqueCardNumber = require("../../../utils/customId/generateUniqueCardNumber");
const {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");


const getAllHotelManagers = catchAsyncError(async (req, res, next) => {
  const results = await getAllUsersByAdmin({ req, model: HotelManagerModel });

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
//----------Hotel-By-ManagerID-
const getHotelByManagerId = catchAsyncError(async (req, res) => {
  const { ownerId } = req.params;

  if (!ownerId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Owner ID is required.");
  }

  // Step 1: Get hotel by manager (ownerId)
  const hotel = await Hotel.findOne({ ownerId: new mongoose.Types.ObjectId(ownerId) })
    .select("hotelName rating businessLicense totalRoom")
    .lean();

  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found for the given manager.");
  }
  //getBankDocuments
const bankDocument = await DocumentsModel.findOne({
  ownerId,
  documentType: "bank_detail",
}).select("documentName file fileType -_id").lean();

  const hotelId = hotel._id;

  // Step 2: Fetch all required related data in parallel
  const [
    hotelImages,
    hotelAddress,
    hotelPolicies,
    hotelFeedbacks,
    roomTypes,
    hotelManager,
    hotelManagerBank
    
  ] = await Promise.all([
    hotelImagesModel.findOne({ hotelId }).select("images").lean(),
    HotelAddressModel.findOne({ hotelId })
      .populate("address", "townCity locality pincode address landmark")
      .lean(),
    HotelPolicyModel.findOne({ hotelId }).select("amenities uploadDocuments checkInTime checkOutTime").lean(),
    HotelFeedbackModel.find({ hotelId }).select("rating").lean(),
    Room.find({ hotelId }).select("roomType roomPrice numberOfRoom").lean(),
    HotelManagerModel.findById(ownerId).select("fullName email phoneNumber avatar gender nationality dob").lean(),
    HotelManagerBankModel.findOne({ userId: ownerId }).select("-_id bankName accountNumber bankDocs").lean()
  ]);

  const selectedImage = hotelImages?.images?.[0] || null;

  const roomTypesWithImages = await Promise.all(
    roomTypes.map(async (room) => {
      const roomImageData = await HotelRoomImagesModel.findOne({
        roomId: room._id,
        roomType: room.roomType
      }).select("images").lean();

      const thumbnailImage = roomImageData?.images?.[0] || null;

      return {
        _id: room._id,
        roomType: room.roomType,
        roomPrice: room.roomPrice,
        numberOfRoom: room.numberOfRoom,
        image: thumbnailImage
      };
    })
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      hotel: {
        hotelId,
        hotelName: hotel.hotelName,
        rating: hotel.rating,
        totalRoom: hotel.totalRoom,
        businessLicense: hotel.businessLicense,
      },
      hotelImage: selectedImage,
      hotelAddress,
      hotelPolicies,
      hotelFeedbacks,
      roomTypes: roomTypesWithImages,
      hotelManager,
      hotelManagerBank,
      bankDocument

    }, "Hotel and manager details fetched successfully.")
  );
});

const searchHotelManagers = catchAsyncError(async (req, res, next) => {
  const phoneNumber = req.query?.phoneNumber?.trim();
const email = req.query?.email?.trim();
const hotelName = req.query?.hotelName?.trim();

 
  console.log("ownerIds for hotelName search:",req.query);
  

  if (!phoneNumber && !email && !hotelName) {
    return res.status(statusCode.BAD_REQUEST).json({
      success: false,
      message: "Please provide phoneNumber, email, or hotelName to search",
    });
  }


  let managersByPhone = [];
  let managersByEmail = [];
  let managersByHotel = [];

  if (phoneNumber) {
    managersByPhone = await HotelManagerModel.find({
      phoneNumber: { $regex: phoneNumber, $options: "i" },
    });
  }

  if (email) {
    managersByEmail = await HotelManagerModel.find({
      email: { $regex: email, $options: "i" },
    });
  }

  if (hotelName) {
    const hotels = await HotelModel.find({
      hotelName: { $regex: hotelName, $options: "i" },
    });

    const ownerIds = hotels
      .map((hotel) => hotel.ownerId)
      .filter(
        (id) => typeof id === "string" && id.trim() !== "" && mongoose.Types.ObjectId.isValid(id)
      )
      .map((id) => mongoose.Types.ObjectId(id));

    if (ownerIds.length > 0) {
      managersByHotel = await HotelManagerModel.find({
        _id: { $in: ownerIds },
      });
    } else {
      managersByHotel = [];
    }
  }

  const allManagers = [...managersByPhone, ...managersByEmail, ...managersByHotel];
  const uniqueManagersMap = new Map();

  allManagers.forEach((manager) => {
    uniqueManagersMap.set(manager._id.toString(), manager);
  });

  const uniqueManagers = Array.from(uniqueManagersMap.values());

  return res.status(statusCode.OK).json({
    success: true,
    message: "Hotel managers fetched successfully",
    data: uniqueManagers,
  });
});

const registerHotelManagerFromAdmin = catchAsyncError(async (req, res, next) => {
 
  if (!req.body) {
    throw new ApiError(statusCode.BAD_REQUEST, "Request body is missing");
  }

  const { fullName, phoneNumber, email } = req.body || {};

  // ✅ Validate required fields
  if (!fullName || !phoneNumber || !email) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Full name, phone number, and email are required."
    );
  }


  const existingUser = await HotelManagerModel.findOne({
    $or: [
      { email: email.toLowerCase() },
      { phoneNumber }
    ]
  }).select("-password");

  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "Email or phone number already exists.");
  }

  let avatarData = null;
  if (req.files?.avatar?.[0]) {
    const localFilePath = req.files.avatar[0].path;
    avatarData = await uploadSingleImageToAws(localFilePath, "hotel-managers");
  }

  const newHotelManager = new HotelManagerModel({
    fullName,
    phoneNumber,
    email: email.toLowerCase(),
    password: "hotelManager@123",
    avatar: avatarData
      ? {
          secure_url: avatarData.secure_url,
          public_id: avatarData.public_id,
        }
      : null,
    isverified: true,
    emailVerified: true,
    phoneNumberVerified: true,
    verificationStatus: "approved",
  });

  await newHotelManager.save();

  // ✅ Create wallet if not exists
  let wallet = await Wallet.findOne({ userId: newHotelManager._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: newHotelManager._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY || "USD",
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  // ✅ Remove password before sending response
  const userObject = newHotelManager.toObject();
  delete userObject.password;

  // ✅ Send success response
  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        { ...userObject, wallet },
        "Hotel Manager created successfully."
      )
    );
});



module.exports = {
  registerHotelManagerFromAdmin,
  getHotelByManagerId,
  getAllHotelManagers,
  getSingleUser,
  verifyUserProfile,
  searchHotelManagers
};
