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

// Define the user schema
const driverSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      minlength: [3, "fullName must be at least 3 characters long"],
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
      default: "driver",
      enum: ["driver"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    verificationStatus: {
      type: String,
      enum: ["submitted", "processing", "approved", "rejected", "blocked"],
      default: "submitted",
    },
    authorities: { type: Schema.Types.Mixed, default: {} },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
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
    idNumber: { type: String },
    nationality: { type: String },
    termAndConditions: {
      type: Boolean,
      default: false,
    },
    nationIdExpiry: { type: Date },
    age: {
      type: Number,
    },
    yrsOfExp: {
      type: Number,
    },
    address: {
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
    coordinates: {
      longitude: { type: String },
      latitude: { type: String },
    },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    yearsOfExperience: { type: Number },
    socketId: {
      type: String,
    },
    vehicle: {
      type: String,
    },
    isAvailable: {
      type:String,
      enum:['onDuty',"offDuty"]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// Middleware to sanitize data
driverSchema.pre("save", function (next) {
  this.email = this.email?.toLowerCase();
  next();
});

// Middleware to hash the password before saving
driverSchema.pre("save", async function (next) {
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

driverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create the user model
const DriverModel = mongoose.model("Driver", driverSchema);

module.exports = DriverModel;
