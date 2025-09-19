const mongoose = require("mongoose");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  sendNotification,
} = require("../../../socket/handlers/notificationHandler");
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
const { NotificationTypeEnum } = require("../../../utils/constants/ENUM");

const createHotelPolicy = catchAsyncError(async (req, res, next) => {
  const { hotelId, checkInTime, checkOutTime, amenities } = req.body;
  const { _id } = req.user;

  if (!_id) {
    return next(new ApiError(statusCode.UNAUTHORIZED, "User not registered."));
  }
  const user = await HotelManagerModel.findById(_id);
  if (!user) {
    return next(new ApiError(statusCode.NOT_FOUND, "User not found."));
  }

  if (!hotelId || !checkInTime || !checkOutTime || !amenities) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "Hotel ID, check-in time, check-out time, and amenities are required."
      )
    );
  }
  if (!req.files?.hotel_license?.length) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "Please upload the hotel license document."
      )
    );
  }
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Invalid hotel ID format.")
    );
  }

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    return next(new ApiError(statusCode.NOT_FOUND, "Hotel not found."));
  }

  const existingPolicy = await HotelPolicyModel.findOne({ hotelId });
  if (existingPolicy) {
    return next(
      new ApiError(statusCode.CONFLICT, "Hotel policy already exists.")
    );
  }

  let parsedAmenities;
  try {
    parsedAmenities =
      typeof amenities === "string" ? JSON.parse(amenities) : amenities;
    if (!Array.isArray(parsedAmenities)) {
      throw new Error();
    }
  } catch (error) {
    return next(
      new ApiError(
        "Amenities must be a valid JSON array.",
        statusCode.BAD_REQUEST
      )
    );
  }

  const hotelimage = req.files.hotel_license[0];
  const uploadResult = await uploadImageOnAws(
    hotelimage.path,
    "hotel-documents"
  );

  const newPolicy = new HotelPolicyModel({
    hotelId,
    checkInTime,
    checkOutTime,
    amenities: parsedAmenities,
    uploadDocuments: [
      {
        name: hotelimage.originalname,
        fileUrl: uploadResult.secure_url,
      },
    ],
  });

  if (user.verificationStatus == "submitted") {
    await HotelManagerModel.findByIdAndUpdate(
      _id,
      { verificationStatus: "processing" },
      { new: true }
    );
  }

  await newPolicy.save();

  // 🔹 Notification logic
  const superAdmins = await AdminModel.find({ role: "SuperAdmin" }).lean();

  const branchAdmins = await AdminModel.find({
    role: { $in: ["Admin", "SubAdmin"] },
    branch: user.branch,
    "permissions.hotelManagement": true,
  }).lean();

  let recipients = [
    ...superAdmins.map((sa) => ({
      adminId: sa._id,
      role: sa.role,
      isRead: false,
    })),
    ...branchAdmins.map((adm) => ({
      adminId: adm._id,
      role: adm.role,
      isRead: false,
    })),
  ];

  if (recipients.length === 0 && superAdmins.length > 0) {
    recipients = [
      { adminId: superAdmins[0]._id, role: "SuperAdmin", isRead: false },
    ];
  }

  await sendNotification({
    recipients,
    type: NotificationTypeEnum.HOTEL_MANAGER_REGISTERED,
    title: "New Hotel Manager Registered",
    message: `New Hotel Manager Registered (ID: ${_id}).`,
    referenceId: hotelId,
    referenceModel: "Hotel",
    createdBy: _id,
  });

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        newPolicy,
        "Hotel policy created successfully."
      )
    );
});

const getHotelPolicy = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Invalid hotel ID format.")
    );
  }
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId }).select(
    " hotelId checkInTime checkOutTime amenities uploadDocuments createdAt updatedAt"
  );
  if (!hotelPolicy) {
    return next(new ApiError(statusCode.NOT_FOUND, "Hotel policy not found."));
  }
  const response = {
    _id: hotelPolicy._id,
    hotelId: hotelPolicy.hotelId,
    checkInTime: hotelPolicy.checkInTime,
    checkOutTime: hotelPolicy.checkOutTime,
    amenities: hotelPolicy.amenities,
    uploadDocuments: hotelPolicy.uploadDocuments || [],
    createdAt: hotelPolicy.createdAt,
    updatedAt: hotelPolicy.updatedAt,
  };
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        response,
        "Hotel policy retrieved successfully."
      )
    );
});

const updateHotelPolicy = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.params;
  const { checkInTime, checkOutTime, amenities } = req.body;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Invalid hotel ID format.")
    );
  }
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId });
  if (!hotelPolicy) {
    return next(new ApiError(statusCode.NOT_FOUND, "Hotel policy not found."));
  }
  hotelPolicy.checkInTime = checkInTime || hotelPolicy.checkInTime;
  hotelPolicy.checkOutTime = checkOutTime || hotelPolicy.checkOutTime;
  if (amenities) {
    try {
      const parsedAmenities =
        typeof amenities === "string" ? JSON.parse(amenities) : amenities;
      if (Array.isArray(parsedAmenities)) {
        hotelPolicy.amenities = parsedAmenities;
      } else {
        throw new Error();
      }
    } catch (error) {
      return next(
        new ApiError(
          "Amenities must be a valid JSON array.",
          statusCode.BAD_REQUEST
        )
      );
    }
  }
  if (req.files?.hotel_license?.length) {
    const file = req.files.hotel_license[0];
    if (hotelPolicy.uploadDocuments && hotelPolicy.uploadDocuments.length > 0) {
      const oldFilePath = hotelPolicy.uploadDocuments[0].fileUrl;
      await deleteImageFromAws(oldFilePath);
    }
    const uploadResult = await uploadImageOnAws(file.path, "hotel-documents");
    if (!uploadResult) {
      return next(
        new ApiError(
          statusCode.INTERNAL_SERVER_ERROR,
          "Failed to upload hotel license document."
        )
      );
    }
    hotelPolicy.uploadDocuments = [
      {
        name: file.originalname,
        fileUrl: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      },
    ];
  }
  await hotelPolicy.save();
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        hotelPolicy,
        "Hotel policy updated successfully."
      )
    );
});

const deleteHotelPolicy = catchAsyncError(async (req, res, next) => {
  const { hotelId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Invalid hotel ID format.")
    );
  }
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId });
  if (!hotelPolicy) {
    return next(new ApiError(statusCode.NOT_FOUND, "Hotel policy not found."));
  }
  if (hotelPolicy.uploadDocuments && hotelPolicy.uploadDocuments.length > 0) {
    await Promise.all(
      hotelPolicy.uploadDocuments.map(async (file) => {
        if (file.fileUrl) {
          const fileName = file.fileUrl.split("/").pop();
          await deleteImageFromAws(fileName);
        }
      })
    );
  }
  await HotelPolicyModel.findOneAndDelete({ hotelId });
  return res.status(statusCode.OK).json({
    success: true,
    message: "Hotel policy and associated files deleted successfully.",
  });
});

module.exports = {
  createHotelPolicy,
  getHotelPolicy,
  updateHotelPolicy,
  deleteHotelPolicy,
};
