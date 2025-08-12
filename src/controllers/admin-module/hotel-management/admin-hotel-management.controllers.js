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
const { AddressModel } = require("../../../models/global-module/address/address.model")
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const mongoose = require("mongoose");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel = require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const { DocumentsModel } = require("../../../models/global-module/documents/document.model");
const Wallet = require('../../../models/wallet-module/wallets.model')
const { uploadSingleImageToAws, uploadMultipleImagesToAws } = require("../../../utils/uploadFiles/images/uploadImages");
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


  console.log("ownerIds for hotelName search:", req.query);


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



// const registerHotelManagerFromAdmin = catchAsyncError(async (req, res, next) => {
//   const {
//     fullName,
//     phoneNumber,
//     email,
//     companyName,
//     companyAddress,

//     // Bank details
//     bankName,
//     accountNumber,

//     // Hotel details
//     hotelName,
//     totalRoom,

//     // Address details
//     address,
//     city,
//     locality,
//     landmark,
//     pincode,

//     // Room details
//     standardRoomCount,
//     luxuryRoomCount,
//     amenities,
//     standardRoomPrice,
//     luxuryRoomPrice,

//     // Policy details
//     checkInTime,
//     checkOutTime,
//     policyAmenities,
//   } = req.body;

//   // Files from multer
//   const hotelImages = req.files?.hotelImages || [];
//   const hotelLicense = req.files?.hotel_license ? req.files.hotel_license[0] : null;
//   const roomImages = req.files?.roomImages || [];
//   const bankDetail = req.files?.bank_detail ? req.files.bank_detail[0] : null;
//   const nationalIdFront = req.files?.national_identity_card_front ? req.files.national_identity_card_front[0] : null;
//   const nationalIdBack = req.files?.national_identity_card_back ? req.files.national_identity_card_back[0] : null;
//   // Basic validations
//   if (!fullName || !phoneNumber || !email) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Full name, phone number, and email are required.");
//   }
//   if (!accountNumber) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Complete bank account details are required.");
//   }
//   if (!hotelName || !totalRoom) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Hotel name and total rooms are required.");
//   }
//   if (!hotelImages || hotelImages.length < 3) {
//     throw new ApiError(statusCode.BAD_REQUEST, "At least 3 hotel images are required.");
//   }
//   if (!city || !pincode) {
//     throw new ApiError(statusCode.BAD_REQUEST, "City and pincode are required for address.");
//   }
//   if (!standardRoomCount || !luxuryRoomCount || !amenities || !standardRoomPrice || !luxuryRoomPrice) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Room counts, amenities, and prices are required.");
//   }
//   if (!roomImages || roomImages.length < 3) {
//     throw new ApiError(statusCode.BAD_REQUEST, "At least 3 room images are required.");
//   }
//   if (!checkInTime || !checkOutTime || !policyAmenities) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Check-in, check-out, and policy amenities are required.");
//   }
//   if (!hotelLicense) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Hotel license document is required.");
//   }
//   if (!bankDetail) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Bank detail document is required.");
//   }

//   // Check if manager already exists
//   const existingUser = await HotelManagerModel.findOne({
//     $or: [{ email: email.toLowerCase() }, { phoneNumber }],
//   }).select("-password");

//   if (existingUser) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Email or phone number already exists.");
//   }
//   const hashedPassword = await bcrypt.hash("hotelManager@123", 10);

//   const newHotelManager =  new HotelManagerModel({
//     fullName,
//     phoneNumber,
//     companyName,
//     companyAddress,
//     email: email.toLowerCase(),
//     password: hashedPassword,
//     avatar: avatarData
//       ? {
//           url: avatarData.url,
//           public_id: avatarData.public_id,
//           fileName: avatarData.fileName,
//           fileType: avatarData.fileType,
//         }
//       : null,
//     isverified: true,
//     emailVerified: true,
//     phoneNumberVerified: true,
//     verificationStatus: "approved",
//   });
//   await newHotelManager.save();

//   // Upload bank detail document (pass as array)
//   let uploadedBankDoc = null;
//   if (bankDetail) {
//     uploadedBankDoc = await uploadSingleImageToAws([bankDetail]);
//   }

//   let newBankAccount = null;
//   if (uploadedBankDoc) {
//     newBankAccount = await HotelManagerBankModel.create({
//       userId: newHotelManager._id,
//       bankName,
//       accountNumber,
//        bankDocs: {
//         url: uploadedBankDoc.url,
//         public_id: uploadedBankDoc.public_id,
//         fileName: uploadedBankDoc.fileName,
//         fileType: uploadedBankDoc.fileType,
//       },
//     });
//   }

//   // Upload National ID front & back (pass as arrays)
//   let uploadedIdFront = null;
//   let uploadedIdBack = null;

//   if (nationalIdFront) {
//     uploadedIdFront = await uploadSingleImageToAws([nationalIdFront]);
//   }
//   if (nationalIdBack) {
//     uploadedIdBack = await uploadSingleImageToAws([nationalIdBack]);
//   }

//   // Save National IDs in manager profile (optional)
//   newHotelManager.nationalIdFront = uploadedIdFront
//     ? {
//         url: uploadedIdFront.url,
//         public_id: uploadedIdFront.public_id,
//         fileName: uploadedIdFront.fileName,
//         fileType: uploadedIdFront.fileType,
//       }
//     : null;

//   newHotelManager.nationalIdBack = uploadedIdBack
//     ? {
//         url: uploadedIdBack.url,
//         public_id: uploadedIdBack.public_id,
//         fileName: uploadedIdBack.fileName,
//         fileType: uploadedIdBack.fileType,
//       }
//     : null;

//   await newHotelManager.save();

//   // Create Wallet
//   let wallet = await Wallet.findOne({ userId: newHotelManager._id });
//   if (!wallet) {
//     wallet = await Wallet.create({
//       userId: newHotelManager._id,
//       balance: 0,
//       currency: process.env.MOMO_CURRENCY || "USD",
//       cardNumber: await generateUniqueCardNumber(),
//     });
//   }

//   // Check if hotel already exists for manager
//   const existingHotel = await Hotel.findOne({
//     ownerId: newHotelManager._id,
//     hotelName,
//   });
//   if (existingHotel) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Hotel with this name already exists.");
//   }

//   // Upload hotel images (multiple)
//   const uploadedHotelImages = await uploadMultipleImagesToAws(hotelImages);

//   // Upload hotel license document (pass as array)
//   let uploadedHotelLicense = null;
//   if (hotelLicense) {
//     uploadedHotelLicense = await uploadSingleImageToAws([hotelLicense]);
//   }

//   // Create Hotel
// const newHotel = await Hotel.create({
//   hotelName,
//   businessLicense: uploadedHotelLicense.url,  // <-- pass only the URL string here
//   totalRoom,
//   ownerId: newHotelManager._id,
// });
//   // Save hotel images
//   await hotelImagesModel.create({
//     hotelId: newHotel._id,
//     images: uploadedHotelImages,
//     uploadedBy: newHotelManager._id,
//   });

//   // Create Hotel Address (create only)
//   const newAddress = new AddressModel({
//     address,
//     townCity: city,
//     locality,
//     landmark,
//     pincode,
//   });
//   await newAddress.save();

//   const newHotelAddress = new HotelAddressModel({
//     hotelId: newHotel._id,
//     address: newAddress._id,
//   });
//   await newHotelAddress.save();

//   // Validate room counts
//   const stdCount = Number(standardRoomCount);
// const luxCount = Number(luxuryRoomCount);
// const totalRoomsCount = stdCount + luxCount;

// if (totalRoomsCount !== Number(totalRoom)) {
//   throw new ApiError(
//     statusCode.BAD_REQUEST,
//     "Sum of standard and luxury room counts must match total rooms."
//   );
// }

// // Upload room images (array, no extra brackets)
// const uploadedRoomImages = await uploadMultipleImagesToAws(roomImages);

// // Parse amenities JSON string or array
// let parsedAmenities;
// try {
//   parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
//   if (!Array.isArray(parsedAmenities)) throw new Error();
// } catch {
//   throw new ApiError(statusCode.BAD_REQUEST, "Amenities must be a valid JSON array.");
// }

// // Parse prices
// const parsedStandardPrice = parseFloat(standardRoomPrice);
// const parsedLuxuryPrice = parseFloat(luxuryRoomPrice);

// if (isNaN(parsedStandardPrice) || parsedStandardPrice <= 0) {
//   throw new ApiError(statusCode.BAD_REQUEST, "Invalid standard room price.");
// }
// if (isNaN(parsedLuxuryPrice) || parsedLuxuryPrice <= 0) {
//   throw new ApiError(statusCode.BAD_REQUEST, "Invalid luxury room price.");
// }

// // Create standard room
// const standardRoom = await Room.create({
//   hotelId: newHotel._id,
//   roomType: "standard",
//   numberOfRoom: stdCount,
//   roomPrice: parsedStandardPrice,
//   amenities: parsedAmenities,
// });

// await HotelRoomImagesModel.create({
//   roomId: standardRoom._id,
//   roomType: "standard",
//   images: uploadedRoomImages,
//   uploadedBy: newHotelManager._id,
// });

// const standardPrefix = "g-";
// const standardIndividualRooms = Array.from({ length: stdCount }, (_, i) => ({
//   roomTypeId: standardRoom._id,
//   hotelId: newHotel._id,
//   roomNumber: `${standardPrefix}${String(i + 1).padStart(2, "0")}`,
// }));
// const standardRoomList = await individualRoom.insertMany(standardIndividualRooms);

// // Create luxury room
// const luxuryRoom = await Room.create({
//   hotelId: newHotel._id,
//   roomType: "luxury",
//   numberOfRoom: luxCount,
//   roomPrice: parsedLuxuryPrice,
//   amenities: parsedAmenities,
// });

// await HotelRoomImagesModel.create({
//   roomId: luxuryRoom._id,
//   roomType: "luxury",
//   images: uploadedRoomImages,
//   uploadedBy: newHotelManager._id,
// });

// const luxuryPrefix = "t-";
// const luxuryIndividualRooms = Array.from({ length: luxCount }, (_, i) => ({
//   roomTypeId: luxuryRoom._id,
//   hotelId: newHotel._id,
//   roomNumber: `${luxuryPrefix}${String(i + 1).padStart(2, "0")}`,
// }));
// const luxuryRoomList = await individualRoom.insertMany(luxuryIndividualRooms);

//   // Hotel Policy creation
//  // Validate amenities JSON
// let parsedPolicyAmenities;
// try {
//   parsedPolicyAmenities = typeof policyAmenities === "string" ? JSON.parse(policyAmenities) : policyAmenities;
//   if (!Array.isArray(parsedPolicyAmenities)) throw new Error();
// } catch {
//   throw new ApiError(statusCode.BAD_REQUEST, "Policy amenities must be a valid JSON array.");
// }

// // Check existing policy for the hotel
// const existingPolicy = await HotelPolicyModel.findOne({ hotelId: newHotel._id });
// if (existingPolicy) {
//   throw new ApiError(statusCode.CONFLICT, "Hotel policy already exists.");
// }

// // Prepare upload documents
// if (!hotelLicense || !uploadedHotelLicense) {
//   throw new ApiError(statusCode.BAD_REQUEST, "Hotel license upload is required for policy documents.");
// }

// const newPolicy = new HotelPolicyModel({
//   hotelId: newHotel._id,
//   checkInTime,
//   checkOutTime,
//   amenities: parsedPolicyAmenities,
//   uploadDocuments: [
//     {
//       name: hotelLicense.originalname,
//       fileUrl: uploadedHotelLicense.url,
//     },
//   ],
// });

// try {
//   await newPolicy.save();
// } catch (err) {
//   throw new ApiError(statusCode.BAD_REQUEST, err.message);
// }


//   // Prepare response
//   const userObject = newHotelManager.toObject();
//   delete userObject.password;

//   return res.status(statusCode.CREATED).json(
//     new ApiResponse(
//       statusCode.CREATED,
//       {
//         user: userObject,
//         bankAccount: newBankAccount,
//         wallet,
//         hotel: newHotel,
//         hotelImages: uploadedHotelImages,
//         address: newHotelAddress,
//         rooms: {
//           standard: {
//             roomDetails: standardRoom,
//             individualRooms: standardRoomList,
//           },
//           luxury: {
//             roomDetails: luxuryRoom,
//             individualRooms: luxuryRoomList,
//           },
//         },
//         policy: newPolicy,
//       },
//       "Hotel Manager, Bank Account, Hotel, Rooms, Address, and Policy created successfully."
//     )
//   );
// })
const registerHotelManagerFromAdmin = catchAsyncError(async (req, res, next) => {
  const { profileInfo, bankInfo, hotelInfo, addressInfo, roomInfo, policyInfo } = req.body;
  const adminId = req.user?._id || "system";
  const createdDocs = [];

  try {
    // Validation
    if (!profileInfo?.fullName || !profileInfo?.phoneNumber || !profileInfo?.email)
      throw new ApiError(statusCode.BAD_REQUEST, "Profile info is incomplete");
    if (!bankInfo?.accountNumber)
      throw new ApiError(statusCode.BAD_REQUEST, "Bank account number required");
    if (
      !hotelInfo?.hotelName ||
      !hotelInfo?.businessLicense ||
      !hotelInfo?.totalRoom
    ) throw new ApiError(400, "Hotel Name, Business License, and Total Room are required");

    const exists = await HotelManagerModel.findOne({
      $or: [
        { email: profileInfo.email.toLowerCase() },
        { phoneNumber: profileInfo.phoneNumber }
      ]
    });
    if (exists) throw new ApiError(statusCode.BAD_REQUEST, "Email or phone already exists");

    // Create manager with all verification fields true by default
    const manager = await HotelManagerModel.create({
      ...profileInfo,
      email: profileInfo.email?.toLowerCase(),
      password: "admin@123",
      createdBy: adminId,
      isverified: true,
      verificationStatus: "approved",
      termAndCondition: true,
      emailVerified: true,
      phoneNumberVerified: true,
    });
    createdDocs.push({ model: HotelManagerModel, id: manager._id });

    if (!bankInfo?.accountNumber) {
      throw new ApiError(400, "Account number is required");
    }
    const bankAccount = await HotelManagerBankModel.create({
      ...bankInfo,
      bankDocs: bankInfo.bankDocs || null,
      userId: manager._id,
      createdBy: adminId
    });
    createdDocs.push({ model: HotelManagerBankModel, id: bankAccount._id });

    // Wallet
    const wallet = await Wallet.create({
      userId: manager._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY || "USD",
      cardNumber: await generateUniqueCardNumber(),
      createdBy: adminId
    });
    createdDocs.push({ model: Wallet, id: wallet._id });

    // Hotel
    const hotel = await Hotel.create({
      ...hotelInfo,
      ownerId: manager._id,
      createdBy: adminId
    });
    createdDocs.push({ model: Hotel, id: hotel._id });

    // Hotel images
    await hotelImagesModel.create({
      hotelId: hotel._id,
      images: (hotelInfo.hotelImages || []).map(img =>
        typeof img === "string" ? { url: img } : img
      ),
      uploadedBy: manager._id,
      createdBy: adminId
    });

    // Address Creation
    const address = await AddressModel.create({
      ...addressInfo,
      createdBy: adminId
    });
    createdDocs.push({ model: AddressModel, id: address._id });

    // Link Address to Hotel
    await HotelAddressModel.create({
      hotelId: hotel._id,
      address: address._id,
      createdBy: adminId
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
      createdBy: adminId
    });
    createdDocs.push({ model: Room, id: standardRoom._id });

    await HotelRoomImagesModel.create({
      roomId: standardRoom._id,
      roomType: "standard",
      images: (roomInfo.standardImages || []).map(img =>
        typeof img === "string" ? { url: img } : img
      ),
      uploadedBy: manager._id,
      createdBy: adminId
    });

    await individualRoom.insertMany(
      Array.from({ length: roomInfo.standardRoomCount }, (_, i) => ({
        roomTypeId: standardRoom._id,
        hotelId: hotel._id,
        roomNumber: `S-${i + 1}`,
        createdBy: adminId
      }))
    );

    // Create Luxury Room
    const luxuryRoom = await Room.create({
      hotelId: hotel._id,
      roomType: "luxury",
      numberOfRoom: roomInfo.luxuryRoomCount,
      roomPrice: parseFloat(roomInfo.luxuryRoomPrice),
      amenities: roomInfo.luxuryAmenities || [],
      createdBy: adminId
    });
    createdDocs.push({ model: Room, id: luxuryRoom._id });

    await HotelRoomImagesModel.create({
      roomId: luxuryRoom._id,
      roomType: "luxury",
      images: (roomInfo.luxuryImages || []).map(img =>
        typeof img === "string" ? { url: img } : img
      ),
      uploadedBy: manager._id,
      createdBy: adminId
    });

    await individualRoom.insertMany(
      Array.from({ length: roomInfo.luxuryRoomCount }, (_, i) => ({
        roomTypeId: luxuryRoom._id,
        hotelId: hotel._id,
        roomNumber: `L-${i + 1}`,
        createdBy: adminId
      }))
    );

    // Policy
    const policy = await HotelPolicyModel.create({
      hotelId: hotel._id,
      ...policyInfo,
      createdBy: adminId
    });
    createdDocs.push({ model: HotelPolicyModel, id: policy._id });

    // *** Fetch all related data to send in response ***

    // Hotel with Address populated
    const hotelWithAddress = await Hotel.findById(hotel._id).lean();

    const hotelAddress = await HotelAddressModel.findOne({ hotelId: hotel._id })
      .populate("address")
      .lean();

    const hotelImages = await hotelImagesModel.findOne({ hotelId: hotel._id }).lean();

    const standardRoomFull = await Room.findById(standardRoom._id).lean();
    const standardRoomImages = await HotelRoomImagesModel.findOne({ roomId: standardRoom._id }).lean();

    const luxuryRoomFull = await Room.findById(luxuryRoom._id).lean();
    const luxuryRoomImages = await HotelRoomImagesModel.findOne({ roomId: luxuryRoom._id }).lean();

    // Build response objects with populated data
    const responseHotel = {
      ...hotelWithAddress,
      address: hotelAddress?.address || null,
      images: hotelImages?.images || []
    };

    const responseStandardRoom = {
      ...standardRoomFull,
      images: standardRoomImages?.images || []
    };

    const responseLuxuryRoom = {
      ...luxuryRoomFull,
      images: luxuryRoomImages?.images || []
    };

    // Final response
    res.status(statusCode.CREATED).json(
      new ApiResponse(statusCode.CREATED, {
        manager,
        bankAccount,
        wallet,
        hotel: responseHotel,
        standardRoom: responseStandardRoom,
        luxuryRoom: responseLuxuryRoom,
        policy
      }, "Hotel Manager & related data created successfully")
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
    next(err instanceof ApiError ? err : new ApiError(statusCode.INTERNAL_SERVER_ERROR, err.message));
  }
});
const updateHotelManagerFromAdmin = catchAsyncError(async (req, res, next) => {
  const { managerId } = req.params; // get id string
  console.log('Manager ID:', managerId);

  const { profileInfo, bankInfo, hotelInfo, addressInfo, roomInfo, policyInfo } = req.body;
  const adminId = req.user?._id || "system";

  try {
    // 1) Update manager
    const manager = await HotelManagerModel.findByIdAndUpdate(
      managerId,
      { 
        ...profileInfo,
        updatedBy: adminId
      },
      { new: true }
    );

    if (!manager) throw new ApiError(404, "Manager not found");

    // 2) Update bank info (find by userId)
    const bankAccount = await HotelManagerBankModel.findOneAndUpdate(
      { userId: manager._id },
      {
        ...bankInfo,
        updatedBy: adminId
      },
      { new: true }
    );

    // 3) (Optional) Update wallet if needed (e.g., currency)
    // Assuming wallet update only allows some fields
    const wallet = await Wallet.findOneAndUpdate(
      { userId: manager._id },
      { 
        ...(req.body.walletInfo || {}),
        updatedBy: adminId
      },
      { new: true }
    );

    // 4) Update hotel info
    const hotel = await Hotel.findOneAndUpdate(
      { ownerId: manager._id },
      {
        ...hotelInfo,
        updatedBy: adminId
      },
      { new: true }
    );

    if (!hotel) throw new ApiError(404, "Hotel not found");

    // 5) Update hotel images
    if (hotelInfo?.hotelImages) {
      // Replace all images or update as needed
      await hotelImagesModel.findOneAndUpdate(
        { hotelId: hotel._id },
        {
          images: hotelInfo.hotelImages.map(img => 
            typeof img === "string" ? { url: img } : img
          ),
          updatedBy: adminId
        },
        { upsert: true, new: true }
      );
    }

    // 6) Update address linked to hotel
    if (addressInfo) {
      const hotelAddress = await HotelAddressModel.findOne({ hotelId: hotel._id });
      if (hotelAddress) {
        await AddressModel.findByIdAndUpdate(
          hotelAddress.address,
          { ...addressInfo, updatedBy: adminId },
          { new: true }
        );
      } else {
        // Create new address and link if missing
        const newAddress = await AddressModel.create({
          ...addressInfo,
          createdBy: adminId
        });
        await HotelAddressModel.create({
          hotelId: hotel._id,
          address: newAddress._id,
          createdBy: adminId
        });
      }
    }

    // 7) Update Rooms and Room Images

    // Standard Room
    if (roomInfo?.standardRoomCount || roomInfo?.standardRoomPrice) {
      const standardRoom = await Room.findOneAndUpdate(
        { hotelId: hotel._id, roomType: "standard" },
        {
          numberOfRoom: roomInfo.standardRoomCount,
          roomPrice: roomInfo.standardRoomPrice ? parseFloat(roomInfo.standardRoomPrice) : undefined,
          amenities: roomInfo.standardAmenities || undefined,
          updatedBy: adminId
        },
        { new: true }
      );

      if (roomInfo?.standardImages) {
        await HotelRoomImagesModel.findOneAndUpdate(
          { roomId: standardRoom._id },
          {
            images: roomInfo.standardImages.map(img => (typeof img === "string" ? { url: img } : img)),
            updatedBy: adminId
          },
          { upsert: true, new: true }
        );
      }
      // Optionally update individualRoom documents if room counts changed (you'll want to handle add/remove carefully)
    }

    // Luxury Room
    if (roomInfo?.luxuryRoomCount || roomInfo?.luxuryRoomPrice) {
      const luxuryRoom = await Room.findOneAndUpdate(
        { hotelId: hotel._id, roomType: "luxury" },
        {
          numberOfRoom: roomInfo.luxuryRoomCount,
          roomPrice: roomInfo.luxuryRoomPrice ? parseFloat(roomInfo.luxuryRoomPrice) : undefined,
          amenities: roomInfo.luxuryAmenities || undefined,
          updatedBy: adminId
        },
        { new: true }
      );

      if (roomInfo?.luxuryImages) {
        await HotelRoomImagesModel.findOneAndUpdate(
          { roomId: luxuryRoom._id },
          {
            images: roomInfo.luxuryImages.map(img => (typeof img === "string" ? { url: img } : img)),
            updatedBy: adminId
          },
          { upsert: true, new: true }
        );
      }
      // Optionally update individualRoom documents as well
    }

    // 8) Update Policy
    const policy = await HotelPolicyModel.findOneAndUpdate(
      { hotelId: hotel._id },
      {
        ...policyInfo,
        updatedBy: adminId
      },
      { new: true, upsert: true }
    );

    // Now populate data for response like before

    const updatedHotelAddress = await HotelAddressModel.findOne({ hotelId: hotel._id }).populate("address");
    const updatedHotelImages = await hotelImagesModel.findOne({ hotelId: hotel._id });
    const updatedStandardRoom = await Room.findOne({ hotelId: hotel._id, roomType: "standard" });
    const updatedStandardRoomImages = await HotelRoomImagesModel.findOne({ roomId: updatedStandardRoom._id });
    const updatedLuxuryRoom = await Room.findOne({ hotelId: hotel._id, roomType: "luxury" });
    const updatedLuxuryRoomImages = await HotelRoomImagesModel.findOne({ roomId: updatedLuxuryRoom._id });

    // Merge images inside rooms
    const standardRoomWithImages = {
      ...updatedStandardRoom.toObject(),
      images: updatedStandardRoomImages?.images || []
    };
    const luxuryRoomWithImages = {
      ...updatedLuxuryRoom.toObject(),
      images: updatedLuxuryRoomImages?.images || []
    };

    // Final response data
    res.status(200).json(
      new ApiResponse(200, {
        manager,
        bankAccount,
        wallet,
        hotel: {
          ...hotel.toObject(),
          address: updatedHotelAddress?.address || null,
          images: updatedHotelImages?.images || []
        },
        standardRoom: standardRoomWithImages,
        luxuryRoom: luxuryRoomWithImages,
        policy
      }, "Hotel Manager & related data updated successfully")
    );

  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(statusCode.INTERNAL_SERVER_ERROR, err.message));
  }
});











module.exports = {
  registerHotelManagerFromAdmin,
  updateHotelManagerFromAdmin ,
  getHotelByManagerId,
  getAllHotelManagers,
  getSingleUser,
  verifyUserProfile,
  searchHotelManagers
};
