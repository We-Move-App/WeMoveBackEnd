const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const {
  validateEmail,
  validatePhoneNumber,
  validateDOBForUser,
  ImageSchema,
} = require("../../../utils/validation/forSchema");
const { hash_rounds } = require("../../../config/config");
const { Schema } = mongoose;

// Define the user schema
const userSchema = new mongoose.Schema(
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
        type:ImageSchema
    },
    role: {
      type: String,
      default: "user",
      enum: ["guest", "user", "user-member"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
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
      ref: "User",
    },
    dob: {
      type: Date,
      validate: {
        validator: function (value) {
          return validateDOBForUser(value).isValid;
        },
        message: (props) => validateDOBForUser(props.value).message,
      },
    },
    idNumber: { type: String },
    nationality: { type: String },
    termAndConditions: {
      type: Boolean,
      default: false,
    },
    nationIdExpiry: { type: Date },
    verifiedBy: {
      createdAt: { type: Date },
      admin: { type: Schema.Types.ObjectId, ref: "Admin" },
    },
    gender: {
      type: String,
      enum: ["male", "female", "not say"],
    },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    socketId: {
      type:String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// Middleware to sanitize data
userSchema.pre("save", function (next) {
  this.email = this.email?.toLowerCase();
  next();
});

// Middleware to hash the password before saving
userSchema.pre("save", async function (next) {
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

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create the user model
const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
