
const {
  HotelManagerBankModel,
} = require("../../../models/hotel-module/hotel-manager-banks/hotel-manager-banks.model");
const {
  HotelManagerDocumentModel,
} = require("../../../models/hotel-module/hotel-manager-documents/hotel-manager-documents.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const statusCode = require("../../../utils/constants/statusCode");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const mongoose = require("mongoose");
const individualRoomModule = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel= require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const {DocumentsModel} = require("../../../models/global-module/documents/document.model");
const {
  uploadSingleImageToAws, deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");
const {
  validateRequestBody,
  getStatusMessage,
} = require("../../../utils/reqFunctions/reqFunction");
const {
  generateTokens,
  setTokenCookies,
} = require("../../../utils/jwtToken/generateTokens");
const { refresh_token_secret, node_env } = require("../../../config/config");
const jwt = require("jsonwebtoken");


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

//..................searchHotelManagers........................


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
  const {
    email,
    fullName,
    address,
    phoneNumber,
    accountHolderName,
    accountNumber,
    bankName,
    isPrimary = true,
  } = req.body;

  const reqFields = [
    "email",
    "fullName",
    "address",
    "phoneNumber",
    "accountHolderName",
    "accountNumber",
    "bankName",
  ];
  validateRequestBody(reqFields, req.body);

  const { avatar, bank_detail } = req.files || {};  

  if (!avatar) {
    throw new ApiError(statusCode.BAD_REQUEST, "Avatar image is required");
  }

  if (!bank_detail) {
    throw new ApiError(statusCode.BAD_REQUEST, "Bank detail document is required");
  }

  const existingUser = await HotelManagerModel.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "User with this email or phone number already exists.");
  }

  // Upload avatar image to AWS S3
  const uploadedAvatar = await uploadSingleImageToAws(avatar);

  // Create hotel manager (auto-approved)
  const newHotelManager = new HotelManagerModel({
    email,
    fullName,
    password:"ADMIN@123", // Default password, should be changed by the user
    address,
    phoneNumber,
    avatar: uploadedAvatar,
    verificationStatus: "approved",
    emailVerified: true,
    phoneNumberVerified: true,
    isverified: true,
    termAndCondition: true,
  });

  await newHotelManager.save();

  // Wallet creation
  let wallet = await Wallet.findOne({ userId: newHotelManager._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: newHotelManager._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY,
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  // Upload and save document in `DocumentModel`
  const uploadedBankDoc = await uploadSingleImageToAws(bank_detail);

  const documentEntry = new DocumentsModel({
    url: uploadedBankDoc.url,
    type: "bank_detail",
    fileName: uploadedBankDoc.fileName || "bank_document",
  });

  await documentEntry.save();

  // Create bank details and reference document
  const bankDetails = new HotelManagerBankModel({
    userId: newHotelManager._id,
    accountHolderName,
    accountNumber,
    bankName,
    isPrimary,
    bankDocs: uploadedBankDoc,
  });

  await bankDetails.save();

  // REQUIRED: Link document in HotelManagerDocumentModel
  const linkedDocuments = new HotelManagerDocumentModel({
    userId: newHotelManager._id,
    documentIds: [documentEntry._id],
  });

  await linkedDocuments.save();

  // Tokens
  const { accessToken, refreshToken } = await generateTokens(
    newHotelManager,
    TypeOfUser.HOTELMANAGER
  );
  setTokenCookies(res, accessToken, refreshToken);

  const responseData = {
    accessToken,
    refreshToken,
    hotelmanager: {
      ...newHotelManager.toObject(),
      password: undefined,
    },
    bankDetails,
    documentReference: linkedDocuments,
  };

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        responseData,
        "Hotel Manager registered successfully with bank document linked"
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
