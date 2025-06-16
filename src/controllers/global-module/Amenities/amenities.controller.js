const AmenitiesModel = require("../../../models/global-module/amenities/amenities.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

// GET all amenities
const getAmenities = catchAsyncError(async (req, res, next) => {
  const { type } = req.query;

  const query = {};
  if (type) {
    query.type = type;
  }

  const amenities = await AmenitiesModel.find(query).select(
    "name description type"
  );

  if (!amenities || amenities.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No amenities found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        amenities,
        "Amenities fetched successfully"
      )
    );
});

const addAmenity = catchAsyncError(async (req, res, next) => {
  const { type, amenities } = req.body;

  if (!type) {
    throw new ApiError(statusCode.BAD_REQUEST, "Type is required");
  }

  if (!Array.isArray(amenities) || amenities.length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Amenities must be provided as a non-empty array"
    );
  }

  const invalidAmenities = amenities.filter(
    (amenity) => typeof amenity !== "string" || amenity.trim() === ""
  );
  if (invalidAmenities.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "All amenities must be valid non-empty strings"
    );
  }

  const normalizedAmenityNames = amenities.map((name) => name.trim());
  const existingAmenities = await AmenitiesModel.find({
    type,
    name: { $in: normalizedAmenityNames },
  });

  const existingNamesSet = new Set(
    existingAmenities.map((amenity) => amenity.name.toLowerCase())
  );

  const newAmenityDocs = normalizedAmenityNames
    .filter((name) => !existingNamesSet.has(name.toLowerCase()))
    .map((name) => ({
      name,
      type,
      description: "",
    }));

  let createdAmenities = [];
  if (newAmenityDocs.length > 0) {
    createdAmenities = await AmenitiesModel.insertMany(newAmenityDocs);
  }

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        createdAmenities,
        skippedAmenities: normalizedAmenityNames.filter((name) =>
          existingNamesSet.has(name.toLowerCase())
        ),
      },
      "Amenities created successfully (duplicates skipped)"
    )
  );
});

module.exports = addAmenity;

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

const updateAmenity = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, type } = req.body;

  if (!id) {
    throw new ApiError(statusCode.BAD_REQUEST, "Amenity ID is required");
  }

  if (!name || !type) {
    throw new ApiError(statusCode.BAD_REQUEST, "Name and type are required");
  }

  const existingAmenity = await AmenitiesModel.findOne({
    name: name.trim(),
    _id: { $ne: id },
  });

  if (existingAmenity) {
    throw new ApiError(statusCode.CONFLICT, "Amenity name already exists");
  }

  const updatedAmenity = await AmenitiesModel.findByIdAndUpdate(
    id,
    { name: name.trim(), description: description || "", type },
    { new: true, runValidators: true }
  );

  if (!updatedAmenity) {
    throw new ApiError(statusCode.NOT_FOUND, "Amenity not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updatedAmenity,
        "Amenity updated successfully"
      )
    );
});

module.exports = { getAmenities, addAmenity, deleteAmenity, updateAmenity };
