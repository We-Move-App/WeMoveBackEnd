const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const {
  validateEmail,
  validatePhoneNumber,
  validateDOB,
  ImageSchema,
} = require("../../../utils/validation/forSchema");
const { hash_rounds } = require("../../../config/config");
const { Schema } = mongoose;

// Define default permissions
const defaultPermissions = {
  busManagement: { type: Boolean, default: false },
  dashboardManagement: { type: Boolean, default: false },
  routeManagement: { type: Boolean, default: false },
  driverManagement: { type: Boolean, default: false },
  ticketManagement: { type: Boolean, default: false },
  walletManagement: { type: Boolean, default: false },
};

const busOperatorSchema = new mongoose.Schema(
  {
    operatorId: {
      type: String,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      trim: true,
      minlength: [3, "fullName must be at least 3 characters long"],
    },
    companyName: {
      type: String,
    },
    companyAddress: {
      type: String,
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
    avatar: {
      type: ImageSchema,
    },
    role: {
      type: String,
      default: "bus-operator",
      enum: ["bus-operator", "bus-operator-member"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    verificationStatus: {
      type: String,
      enum: ["submitted", "processing", "approved", "rejected", "blocked"],
      default: "submitted",
    },
    authorities: { type: Schema.Types.Mixed, default: {} },
    permissions: {
      type: defaultPermissions,
      default: () => ({
        busManagement: false,
        dashboardManagement: false,
        routeManagement: false,
        driverManagement: false,
        ticketManagement: false,
        walletManagement: false,
      }),
    },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "bus-operator",
      required: function () {
        return this.role === "bus-operator-member";
      },
    },
    dob: {
      type: Date,
      validate: {
        validator: function (value) {
          return validateDOB(value).isValid;
        },
        message: (props) => validateDOB(props.value).message,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    idNumber: { type: String },
    nationality: { type: String },
    termAndCondition: {
      type: Boolean,
      default: false,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    nationIdExpiry: { type: Date },
    businessLicenseNumber: {
      type: String,
    },
    verifiedBy: {
      createdAt: { type: Date },
      admin: { type: Schema.Types.ObjectId, ref: "Admin" },
    },
    gender: {
      type: String,
      enum: ["male", "female", "prefer not to say"],
    },
    emailVerified: { type: Boolean, default: false },
    phoneNumberVerified: { type: Boolean, default: false },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    identityCardNumber: {
      type: String,
    },
    socketId: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// Middleware to sanitize data
busOperatorSchema.pre("save", function (next) {
  this.email = this.email?.toLowerCase();
  next();
});

// Middleware to hash the password before saving
busOperatorSchema.pre("save", async function (next) {
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

busOperatorSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

busOperatorSchema.pre("save", function (next) {
  if (this.role === "bus-operator") {
    this.permissions = {
      busManagement: true,
      dashboardManagement: true,
      routeManagement: true,
      driverManagement: true,
      ticketManagement: true,
      walletManagement: true,
    };
  }
  next();
});

// Create the user model
const BusOperatorModel = mongoose.model("BusOperator", busOperatorSchema);

module.exports = BusOperatorModel;
