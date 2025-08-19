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
const {logActivity} = require("../../../utils/ActivityLog/ActivityLog")

// ADD BRANCH
const addBranch = catchAsyncError(async (req, res, next) => {
  const { name, location, latitude, longitude, adminId } = req.body;

  // ✅ Only SuperAdmin (and optionally Admin) can create branches
  if (req.user.role !== "SuperAdmin" && req.user.role !== "Admin") {
    throw new ApiError(statusCode.FORBIDDEN, "Not authorized to create branch");
  }

  const reqField = ["name", "location", "latitude", "longitude"];
  validateRequestBody(reqField, req.body);

  let assignedAdmin = null;

  if (adminId) {
    validateMongooseId(adminId);

    const findAdmin = await AdminModel.findById(adminId).select("_id branch");

    if (!findAdmin) {
      throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
    }

    if (findAdmin.branch) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "This admin is already assigned to another branch"
      );
    }

    assignedAdmin = findAdmin._id;
  }

  const branch = await BranchModel.create({
    name,
    location,
    coordinates: {
      latitude,
      longitude,
    },
  });

  if (assignedAdmin) {
    await AdminModel.findByIdAndUpdate(assignedAdmin, { branch: branch._id });
  }
  const activityLog = await logActivity(
    req.user._id,
    `Created a new branch: ${name}`
  );
 return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(statusCode.OK, { branch, UserActivity: activityLog }, "Branch created successfully")
    );
});

// GET ALL BRANCHES
const getAllBranches = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const { name, location } = req.query;

  const query = {};
  if (name) {
    query.$or.push({
      name: { $regex: name, $options: "i" },
    });
  }
  if (location) {
    query.$or.push({
      location: { $regex: location, $options: "i" },
    });
  }

  const branches = await BranchModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  if (!branches || branches.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Branches not found");
  }

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
  const activityLog = await logActivity(
    req.user._id,
    `Deleted branch: ${deletedBranch.name}`
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      { branch: deletedBranch, UserActivity: activityLog },
      "Branch deleted successfully"
    )
  );
});
const updateBranchById = catchAsyncError(async (req, res, next) => {
  const { branchId } = req.params;
  const { name, location, latitude, longitude, adminId } = req.body;
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

 const activityLog = await logActivity(
    req.user._id,
    `Updated branch: ${updatedBranch.name}`
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      { branch: updatedBranch, UserActivity: activityLog },
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
