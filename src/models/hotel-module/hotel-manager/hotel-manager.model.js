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

const hotelManagerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      minlength: [3, "Full name must be at least 3 characters long"],
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
    companyName:{
      type: String,
    },
    companyAddress:{
      type: String
    },
    
    role: {
      type: String,
      default: "hotel-manager",
      enum: ["hotel-manager", "hotel-member"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isverified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: [
        "submitted",
        "processing",
        "waiting-for-approval",
        "approved",
        "rejected",
        "blocked",
      ],
      default: "submitted",
    },
    authorities: { type: Schema.Types.Mixed, default: {} },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "Hotel-Manager",
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
    termAndCondition: {
      type: Boolean,
      default: false,
    },
    nationIdExpiry: { type: Date },
    businessLicense: {
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

hotelManagerSchema.pre("save", function (next) {
  this.email = this.email?.toLowerCase();
  next();
});

hotelManagerSchema.pre("save", async function (next) {
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

// Password comparison method
hotelManagerSchema.methods.comparePassword = async function (
  candidatePassword
) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create the Hotel Manager model
const HotelManagerModel = mongoose.model("Hotel-Manager", hotelManagerSchema);

module.exports = HotelManagerModel;
