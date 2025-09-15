const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
const {
  BranchModel,
} = require("../../../models/admin-module/branch/branches.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
  validateMongooseId,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const { logActivity } = require("../../../utils/ActivityLog/ActivityLog");

const addBranch = catchAsyncError(async (req, res, next) => {
  const { name, location } = req.body;

  // ✅ Role check
  if (req.user.role !== "SuperAdmin" && req.user.role !== "Admin") {
    throw new ApiError(statusCode.FORBIDDEN, "Not authorized to create branch");
  }

  // ✅ Validate required fields
  const reqField = ["name", "location"];
  validateRequestBody(reqField, req.body);

  // ✅ Check if branch already exists in this location
  const existingBranch = await BranchModel.findOne({ location });
  if (existingBranch) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `A branch already exists in ${location}`
    );
  }

  let branch;
  try {
    // ✅ Create new branch
    branch = await BranchModel.create({
      name,
      location,
    });
  } catch (error) {
    // ✅ Handle duplicate key error at DB level
    if (error.code === 11000 && error.keyPattern?.location) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        `A branch already exists in ${location}`
      );
    }
    throw error;
  }

  // ✅ Log activity
  const activityLog = await logActivity({
    userId: req.user._id,
    activity: `Created a new branch: ${name} at ${location}`,
    performedBy: req.user._id,
    type: "create",
  });

  // ✅ Response
  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        { branch, UserActivity: activityLog },
        "Branch created successfully"
      )
    );
});

const getAllBranches = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const filter = req.query.filter ? String(req.query.filter).trim() : "";

  const query = {};

  if (filter) {
    const escaped = filter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: `^${escaped}`, $options: "i" };
  }

  const branches = await BranchModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  const totalData = await BranchModel.countDocuments(query).exec();

  const data = {
    branches,
    totalPages: Math.ceil(totalData / limit),
    currentPage: page,
    totalCount: totalData,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, "Data found"));
});

const getBranchById = catchAsyncError(async (req, res, next) => {
  const { branchId } = req.params;

  const branch = await BranchModel.findById(branchId);
  if (!branch) {
    throw new ApiError(statusCode.NOT_FOUND, "Branch not found");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, branch, "Branch Found Successfully"));
});
const deleteBranchById = catchAsyncError(async (req, res, next) => {
  const { branchId } = req.params;

  const deletedBranch = await BranchModel.findByIdAndDelete(branchId);

  if (!deletedBranch) {
    throw new ApiError(statusCode.NOT_FOUND, "Branch not found");
  }

  // Log activity
  const activityLog = await logActivity({
    userId: req.user._id, // logged-in admin, not branch id
    activity: `Delete branch: ${deletedBranch.name}`,
    performedBy: req.user._id,
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { branch: deletedBranch, UserActivity: activityLog },
        "Branch deleted successfully"
      )
    );
});
const updateBranchById = catchAsyncError(async (req, res, next) => {
  const { branchId } = req.params;
  const { name, location, latitude, longitude } = req.body;

  const updateData = {
    name,
    location,
    coordinates: {
      latitude,
      longitude,
    },
  };

  const updatedBranch = await BranchModel.findByIdAndUpdate(
    branchId,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedBranch) {
    throw new ApiError(statusCode.NOT_FOUND, "Not found");
  }

  const activityLog = await logActivity({
    userId: req.user._id, // logged-in admin, not branch id
    activity: `Updated branch: ${updatedBranch.name}`,
    performedBy: req.user._id,
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { branch: updatedBranch, activityLog },
        "Branch updated successfully"
      )
    );
});

module.exports = {
  addBranch,
  getAllBranches,
  getBranchById,
  deleteBranchById,
  updateBranchById,
};
