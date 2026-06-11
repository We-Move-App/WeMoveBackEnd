const AmenitiesModel = require("../../../models/global-module/amenities/amenities.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const { uploadAmenityImages } = require("../../../utils/uploadFiles/multer");

const {
  uploadSingleImageToAws,
  uploadMultipleImagesToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

const { translateLn } = require("../../../utils/services/translator.service");

const getAmenities = catchAsyncError(async (req, res, next) => {
  const {
    type,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  const ln = (req.headers["ln"] || "en").toLowerCase();

  const query = {};

  // ✅ Filter by type
  if (type) {
    query.type = type;
  }

  // ✅ Global search
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
    ];
  }

  // ✅ Pagination
  const pageNumber = parseInt(page, 10) || 1;
  const limitNumber = parseInt(limit, 10) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  // ✅ Sorting
  const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;
  const sortCriteria = { [sortBy]: sortOrder };

  // ✅ Total count
  const total = await AmenitiesModel.countDocuments(query);
  const totalPages = Math.ceil(total / limitNumber);

  // ✅ Fetch data
  const amenities = await AmenitiesModel.find(query)
    .select("name description type icon status createdAt updatedAt")
    .sort(sortCriteria)
    .skip(skip)
    .limit(limitNumber);

  if (!amenities || amenities.length === 0) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "NO_AMENITIES_FOUND")
    );
  }

  // ✅ Key formatter
  const formatAmenityKey = (name) =>
    `AMENITY_${name
      ?.toUpperCase()
      .replace(/WI[-\s]?FI/g, "WIFI")
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")}`;

  // ✅ Translate amenities name + description + status
  const translatedAmenities = amenities.map((item) => {
    const amenityObj = item.toObject();

    return {
      ...amenityObj,
      name: translateLn(ln, formatAmenityKey(item.name)),
      description:
        item.description?.trim() !== ""
          ? translateLn(ln, `${formatAmenityKey(item.name)}_DESCRIPTION`)
          : "",
      status: translateLn(ln, item.status?.toUpperCase()),
    };
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        total,
        totalPages,
        page: pageNumber,
        limit: limitNumber,
        data: translatedAmenities,
      },
      translateLn(ln, "AMENITIES_FETCHED_SUCCESSFULLY")
    )
  );
});

const addAmenity = catchAsyncError(async (req, res, next) => {
  const { type, amenities } = req.body;

  if (!type) {
    throw new ApiError(statusCode.BAD_REQUEST, "Type is required");
  }

  // Parse amenities if sent as JSON string or skip if missing
  const parsedAmenities = amenities
    ? typeof amenities === "string"
      ? JSON.parse(amenities)
      : amenities
    : [];

  // Upload images if provided
  const files = req.files || [];
  const uploadedImages =
    files.length > 0 ? await uploadMultipleImagesToAws(files) : [];

  // Map amenities with optional images and status
  const normalizedAmenities = parsedAmenities.map((a, index) => ({
    name: a.name?.trim() || "",
    description: a.description || "",
    icon: uploadedImages[index]?.url || "", // optional
    status: a.status || "active",
  }));

  // Keep only amenities with a name
  const validAmenities = normalizedAmenities.filter((a) => a.name);

  let createdAmenities = [];
  if (validAmenities.length > 0) {
    // Check for existing amenities to avoid duplicates
    const existingAmenities = await AmenitiesModel.find({
      type,
      name: { $in: validAmenities.map((a) => a.name) },
    });

    const existingNamesSet = new Set(
      existingAmenities.map((a) => a.name.toLowerCase())
    );

    // Only create new amenities
    const newAmenityDocs = validAmenities
      .filter((a) => !existingNamesSet.has(a.name.toLowerCase()))
      .map((a) => ({ ...a, type }));

    if (newAmenityDocs.length > 0) {
      createdAmenities = await AmenitiesModel.insertMany(newAmenityDocs);
    }
  }

  // Clean __v from response
  const cleanedAmenities = createdAmenities.map((a) => {
    const { __v, ...rest } = a.toObject();
    return rest;
  });

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        createdAmenities: cleanedAmenities,
        skippedAmenities: validAmenities
          .filter(
            (a) =>
              !cleanedAmenities.find(
                (ca) => ca.name.toLowerCase() === a.name.toLowerCase()
              )
          )
          .map((a) => a.name),
      },
      "Amenities created successfully (duplicates skipped)"
    )
  );
});

// DELETE an amenity by ID
const deleteAmenity = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const deletedAmenity = await AmenitiesModel.findByIdAndDelete(id);
  if (!deletedAmenity) {
    throw new ApiError(statusCode.NOT_FOUND, "Amenity not found or deleted");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        deletedAmenity,
        "Amenity deleted successfully"
      )
    );
});

// UPDATE an amenity by ID

const updateAmenity = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, type, amenities, status } = req.body;
  const files = req.files || [];
  console.log("Files received for update:", files);
  console.log("Request body:", req.body);

  if (!id) throw new ApiError(statusCode.BAD_REQUEST, "Amenity ID is required");
  if (!name || !type)
    throw new ApiError(statusCode.BAD_REQUEST, "Name and type are required");

  const existingAmenity = await AmenitiesModel.findById(id);
  if (!existingAmenity)
    throw new ApiError(statusCode.NOT_FOUND, "Amenity not found");

  // Check for duplicate name
  const duplicateAmenity = await AmenitiesModel.findOne({
    _id: { $ne: id },
    name: name.trim(),
  });
  if (duplicateAmenity)
    throw new ApiError(statusCode.CONFLICT, "Amenity name already exists");

  // Handle icon upload
  let iconUrl = existingAmenity.icon || "";
  if (files.length > 0) {
    if (existingAmenity.icon) {
      const oldKey = existingAmenity.icon.split(".com/")[1];
      await deleteImageFromAws(oldKey);
    }
    const uploadedImages = await uploadMultipleImagesToAws(files);
    iconUrl = uploadedImages[0]?.url || iconUrl;
  }

  // Parse amenities array if string
  const parsedAmenities = amenities
    ? typeof amenities === "string"
      ? JSON.parse(amenities)
      : amenities
    : [];

  const normalizedAmenities = parsedAmenities.map((a) => ({
    name: a.name?.trim() || "",
    description: a.description || "",
    status: a.status || "active",
  }));

  // Update amenity fields
  existingAmenity.name = name.trim();
  existingAmenity.description = description || "";
  existingAmenity.type = type;
  existingAmenity.status = status || existingAmenity.status;
  existingAmenity.icon = iconUrl;
  if (normalizedAmenities.length > 0)
    existingAmenity.amenities = normalizedAmenities;

  const updatedAmenity = await existingAmenity.save();
  const { __v, ...cleanedAmenity } = updatedAmenity.toObject();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        cleanedAmenity,
        "Amenity updated successfully"
      )
    );
});

module.exports = { getAmenities, addAmenity, deleteAmenity, updateAmenity };
