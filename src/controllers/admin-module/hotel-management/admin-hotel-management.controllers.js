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
const {AddressModel} = require("../../../models/global-module/address/address.model")
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const mongoose = require("mongoose");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel= require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const {DocumentsModel} = require("../../../models/global-module/documents/document.model");
const Wallet=require('../../../models/wallet-module/wallets.model')
const { uploadSingleImageToAws ,  uploadMultipleImagesToAws } = require("../../../utils/uploadFiles/images/uploadImages");
const generateUniqueCardNumber = require("../../../utils/customId/generateUniqueCardNumber");
const {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");
const bcrypt = require("bcrypt");




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
  const {
    fullName,
    phoneNumber,
    email,
    companyName,
    companyAddress,

    // Bank details
    bankName,
    accountNumber,

    // Hotel details
    hotelName,
    totalRoom,

    // Address details
    address,
    city,
    locality,
    landmark,
    pincode,

    // Room details
    standardRoomCount,
    luxuryRoomCount,
    amenities,
    standardRoomPrice,
    luxuryRoomPrice,

    // Policy details
    checkInTime,
    checkOutTime,
    policyAmenities,
  } = req.body;

  // Files from multer
  const avatar = req.files?.avatar ? req.files.avatar[0] : null;
  const hotelImages = req.files?.hotelImages || [];
  const hotelLicense = req.files?.hotel_license ? req.files.hotel_license[0] : null;
  const roomImages = req.files?.roomImages || [];
  const bankDetail = req.files?.bank_detail ? req.files.bank_detail[0] : null;
  const nationalIdFront = req.files?.national_identity_card_front ? req.files.national_identity_card_front[0] : null;
  const nationalIdBack = req.files?.national_identity_card_back ? req.files.national_identity_card_back[0] : null;

  // Basic validations
  if (!fullName || !phoneNumber || !email) {
    throw new ApiError(statusCode.BAD_REQUEST, "Full name, phone number, and email are required.");
  }
  if (!accountNumber) {
    throw new ApiError(statusCode.BAD_REQUEST, "Complete bank account details are required.");
  }
  if (!hotelName || !totalRoom) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel name and total rooms are required.");
  }
  if (!hotelImages || hotelImages.length < 3) {
    throw new ApiError(statusCode.BAD_REQUEST, "At least 3 hotel images are required.");
  }
  if (!city || !pincode) {
    throw new ApiError(statusCode.BAD_REQUEST, "City and pincode are required for address.");
  }
  if (!standardRoomCount || !luxuryRoomCount || !amenities || !standardRoomPrice || !luxuryRoomPrice) {
    throw new ApiError(statusCode.BAD_REQUEST, "Room counts, amenities, and prices are required.");
  }
  if (!roomImages || roomImages.length < 3) {
    throw new ApiError(statusCode.BAD_REQUEST, "At least 3 room images are required.");
  }
  if (!checkInTime || !checkOutTime || !policyAmenities) {
    throw new ApiError(statusCode.BAD_REQUEST, "Check-in, check-out, and policy amenities are required.");
  }
  if (!hotelLicense) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel license document is required.");
  }
  if (!bankDetail) {
    throw new ApiError(statusCode.BAD_REQUEST, "Bank detail document is required.");
  }

  // Check if manager already exists
  const existingUser = await HotelManagerModel.findOne({
    $or: [{ email: email.toLowerCase() }, { phoneNumber }],
  }).select("-password");

  if (existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, "Email or phone number already exists.");
  }

  // Upload avatar image if present (pass as array)
  let avatarData = null;
  if (avatar) {
    avatarData = await uploadSingleImageToAws([avatar]);
  }

  // Hash default password
  const hashedPassword = await bcrypt.hash("hotelManager@123", 10);

  // Create Hotel Manager
  const newHotelManager = new HotelManagerModel({
    fullName,
    phoneNumber,
    companyName,
    companyAddress,
    email: email.toLowerCase(),
    password: hashedPassword,
    avatar: avatarData
      ? {
          url: avatarData.url,
          public_id: avatarData.public_id,
          fileName: avatarData.fileName,
          fileType: avatarData.fileType,
        }
      : null,
    isverified: true,
    emailVerified: true,
    phoneNumberVerified: true,
    verificationStatus: "approved",
  });
  await newHotelManager.save();

  // Upload bank detail document (pass as array)
  let uploadedBankDoc = null;
  if (bankDetail) {
    uploadedBankDoc = await uploadSingleImageToAws([bankDetail]);
  }

  let newBankAccount = null;
  if (uploadedBankDoc) {
    newBankAccount = await HotelManagerBankModel.create({
      userId: newHotelManager._id,
      bankName,
      accountNumber,
       bankDocs: {
        url: uploadedBankDoc.url,
        public_id: uploadedBankDoc.public_id,
        fileName: uploadedBankDoc.fileName,
        fileType: uploadedBankDoc.fileType,
      },
    });
  }

  // Upload National ID front & back (pass as arrays)
  let uploadedIdFront = null;
  let uploadedIdBack = null;

  if (nationalIdFront) {
    uploadedIdFront = await uploadSingleImageToAws([nationalIdFront]);
  }
  if (nationalIdBack) {
    uploadedIdBack = await uploadSingleImageToAws([nationalIdBack]);
  }

  // Save National IDs in manager profile (optional)
  newHotelManager.nationalIdFront = uploadedIdFront
    ? {
        url: uploadedIdFront.url,
        public_id: uploadedIdFront.public_id,
        fileName: uploadedIdFront.fileName,
        fileType: uploadedIdFront.fileType,
      }
    : null;

  newHotelManager.nationalIdBack = uploadedIdBack
    ? {
        url: uploadedIdBack.url,
        public_id: uploadedIdBack.public_id,
        fileName: uploadedIdBack.fileName,
        fileType: uploadedIdBack.fileType,
      }
    : null;

  await newHotelManager.save();

  // Create Wallet
  let wallet = await Wallet.findOne({ userId: newHotelManager._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: newHotelManager._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY || "USD",
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  // Check if hotel already exists for manager
  const existingHotel = await Hotel.findOne({
    ownerId: newHotelManager._id,
    hotelName,
  });
  if (existingHotel) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel with this name already exists.");
  }

  // Upload hotel images (multiple)
  const uploadedHotelImages = await uploadMultipleImagesToAws(hotelImages);

  // Upload hotel license document (pass as array)
  let uploadedHotelLicense = null;
  if (hotelLicense) {
    uploadedHotelLicense = await uploadSingleImageToAws([hotelLicense]);
  }

  // Create Hotel
const newHotel = await Hotel.create({
  hotelName,
  businessLicense: uploadedHotelLicense.url,  // <-- pass only the URL string here
  totalRoom,
  ownerId: newHotelManager._id,
});
  // Save hotel images
  await hotelImagesModel.create({
    hotelId: newHotel._id,
    images: uploadedHotelImages,
    uploadedBy: newHotelManager._id,
  });

  // Create Hotel Address (create only)
  const newAddress = new AddressModel({
    address,
    townCity: city,
    locality,
    landmark,
    pincode,
  });
  await newAddress.save();

  const newHotelAddress = new HotelAddressModel({
    hotelId: newHotel._id,
    address: newAddress._id,
  });
  await newHotelAddress.save();

  // Validate room counts
  const stdCount = Number(standardRoomCount);
const luxCount = Number(luxuryRoomCount);
const totalRoomsCount = stdCount + luxCount;

if (totalRoomsCount !== Number(totalRoom)) {
  throw new ApiError(
    statusCode.BAD_REQUEST,
    "Sum of standard and luxury room counts must match total rooms."
  );
}

// Upload room images (array, no extra brackets)
const uploadedRoomImages = await uploadMultipleImagesToAws(roomImages);

// Parse amenities JSON string or array
let parsedAmenities;
try {
  parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
  if (!Array.isArray(parsedAmenities)) throw new Error();
} catch {
  throw new ApiError(statusCode.BAD_REQUEST, "Amenities must be a valid JSON array.");
}

// Parse prices
const parsedStandardPrice = parseFloat(standardRoomPrice);
const parsedLuxuryPrice = parseFloat(luxuryRoomPrice);

if (isNaN(parsedStandardPrice) || parsedStandardPrice <= 0) {
  throw new ApiError(statusCode.BAD_REQUEST, "Invalid standard room price.");
}
if (isNaN(parsedLuxuryPrice) || parsedLuxuryPrice <= 0) {
  throw new ApiError(statusCode.BAD_REQUEST, "Invalid luxury room price.");
}

// Create standard room
const standardRoom = await Room.create({
  hotelId: newHotel._id,
  roomType: "standard",
  numberOfRoom: stdCount,
  roomPrice: parsedStandardPrice,
  amenities: parsedAmenities,
});

await HotelRoomImagesModel.create({
  roomId: standardRoom._id,
  roomType: "standard",
  images: uploadedRoomImages,
  uploadedBy: newHotelManager._id,
});

const standardPrefix = "g-";
const standardIndividualRooms = Array.from({ length: stdCount }, (_, i) => ({
  roomTypeId: standardRoom._id,
  hotelId: newHotel._id,
  roomNumber: `${standardPrefix}${String(i + 1).padStart(2, "0")}`,
}));
const standardRoomList = await individualRoom.insertMany(standardIndividualRooms);

// Create luxury room
const luxuryRoom = await Room.create({
  hotelId: newHotel._id,
  roomType: "luxury",
  numberOfRoom: luxCount,
  roomPrice: parsedLuxuryPrice,
  amenities: parsedAmenities,
});

await HotelRoomImagesModel.create({
  roomId: luxuryRoom._id,
  roomType: "luxury",
  images: uploadedRoomImages,
  uploadedBy: newHotelManager._id,
});

const luxuryPrefix = "t-";
const luxuryIndividualRooms = Array.from({ length: luxCount }, (_, i) => ({
  roomTypeId: luxuryRoom._id,
  hotelId: newHotel._id,
  roomNumber: `${luxuryPrefix}${String(i + 1).padStart(2, "0")}`,
}));
const luxuryRoomList = await individualRoom.insertMany(luxuryIndividualRooms);

  // Hotel Policy creation
 // Validate amenities JSON
let parsedPolicyAmenities;
try {
  parsedPolicyAmenities = typeof policyAmenities === "string" ? JSON.parse(policyAmenities) : policyAmenities;
  if (!Array.isArray(parsedPolicyAmenities)) throw new Error();
} catch {
  throw new ApiError(statusCode.BAD_REQUEST, "Policy amenities must be a valid JSON array.");
}

// Check existing policy for the hotel
const existingPolicy = await HotelPolicyModel.findOne({ hotelId: newHotel._id });
if (existingPolicy) {
  throw new ApiError(statusCode.CONFLICT, "Hotel policy already exists.");
}

// Prepare upload documents
if (!hotelLicense || !uploadedHotelLicense) {
  throw new ApiError(statusCode.BAD_REQUEST, "Hotel license upload is required for policy documents.");
}

const newPolicy = new HotelPolicyModel({
  hotelId: newHotel._id,
  checkInTime,
  checkOutTime,
  amenities: parsedPolicyAmenities,
  uploadDocuments: [
    {
      name: hotelLicense.originalname,
      fileUrl: uploadedHotelLicense.url,
    },
  ],
});

try {
  await newPolicy.save();
} catch (err) {
  throw new ApiError(statusCode.BAD_REQUEST, err.message);
}


  // Prepare response
  const userObject = newHotelManager.toObject();
  delete userObject.password;

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        user: userObject,
        bankAccount: newBankAccount,
        wallet,
        hotel: newHotel,
        hotelImages: uploadedHotelImages,
        address: newHotelAddress,
        rooms: {
          standard: {
            roomDetails: standardRoom,
            individualRooms: standardRoomList,
          },
          luxury: {
            roomDetails: luxuryRoom,
            individualRooms: luxuryRoomList,
          },
        },
        policy: newPolicy,
      },
      "Hotel Manager, Bank Account, Hotel, Rooms, Address, and Policy created successfully."
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
