const mongoose = require("mongoose");
const {
  validatePhoneNumber,
  validateEmail,
  ImageSchema,
} = require("../../../utils/validation/forSchema");
const { hash_rounds } = require("../../../config/config");
const { Schema } = mongoose;
const bcrypt = require("bcrypt");

const defaultPermissions = {
  userManagement: { type: Boolean, default: false },
  busManagement: { type: Boolean, default: false },
  taxiManagement: { type: Boolean, default: false },
  bikeManagement: { type: Boolean, default: false },
  hotelManagement: { type: Boolean, default: false },
  walletManagement: { type: Boolean, default: false },
  reportsAnalytics: { type: Boolean, default: false },
  notifications: { type: Boolean, default: false },
  roleManagement: { type: Boolean, default: false },
  commissionManagement: { type: Boolean, default: false },
  couponManagement: { type: Boolean, default: false },
};

// Admin Schema
const AdminSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      trim: true,
      minlength: [3, "fullName must be at least 3 characters long"],
      unique: true,
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      validate: {
        validator: validateEmail,
        message: (props) => `${props.value} is not a valid email address!`,
      },
      sparse: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      validate: {
        validator: validatePhoneNumber,
        message: (props) => `${props.value} is not a valid phone number!`,
      },
      sparse: true,
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
    },
    role: {
      type: String,
      enum: ["SuperAdmin", "Admin", "SubAdmin"],
      required: true,
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: function () {
        return this.role !== "SuperAdmin";
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    permissions: defaultPermissions,
    verificationStatus: {
      type: String,
      enum: ["approved", "rejected", "blocked", "submitted"],
      default: "approved",
    },
    createdAt: { type: Date, default: Date.now },
    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    avatar: {
      type: ImageSchema,
    },
    socketId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to set permissions based on role
AdminSchema.pre("save", function (next) {
  if (this.role === "SuperAdmin") {
    this.permissions = {
      userManagement: true,
      busManagement: true,
      taxiManagement: true,
      bikeManagement: true,
      hotelManagement: true,
      walletManagement: true,
      reportsAnalytics: true,
      notifications: true,
      roleManagement: true,
      commissionManagement: true,
      couponManagement: true,
    };
  }
  next();
});

AdminSchema.pre("save", function (next) {
  this.email = this.email?.toLowerCase();
  next();
});

AdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(Number(hash_rounds));
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

AdminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const AdminModel = mongoose.model("Admin", AdminSchema);

module.exports = { AdminModel, defaultPermissions };
