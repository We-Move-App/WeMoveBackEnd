const mongoose = require("mongoose");
const { Schema } = mongoose;

const CouponSchema = new Schema(
  {
    couponName: {
      type: String,
      required: [true, "Coupon Name is required"],
      trim: true,
      unique: true,
      minlength: [3, "Coupon Name must be at least 3 characters long"],
    },
    couponCode: {
      type: String,
      required: [true, "Coupon Code is required"],
      trim: true,
      unique: true,
      minlength: [3, "Coupon Code must be at least 3 characters long"],
    },
    serviceType: {
      type: String,
      enum: ["Hotel", "Bus", "Bike", "Taxi", "All Services"],
      required: [true, "Service Type is required"],
      default: "All Services",
    },
    minOrderAmount: { type: Number, default: 0 },
    // maxDiscountAmount: { type: Number, default: null },
    discountType: {
      type: String,
      enum: ["Percentage", "Fixed Amount"],
      required: [true, "Discount Type is required"],
    },
    discountPercentage: {
      type: Number,
      min: [0, "Discount percentage cannot be negative"],
      max: [99, "Discount percentage cannot exceed 99"],
      required: function () {
        return this.discountType === "Percentage";
      },
      validate: {
        validator: function (value) {
          return this.discountType === "Percentage" ? value !== undefined : true;
        },
        message: "Discount Percentage is required when discount type is Percentage",
      },
    },
    discountAmount: {
      type: Number,
      min: [0, "Discount amount cannot be negative"],
      required: function () {
        return this.discountType === "Fixed Amount";
      },
      validate: {
        validator: function (value) {
          return this.discountType === "Fixed Amount" ? value !== undefined : true;
        },
        message: "Discount Amount is required when discount type is Fixed Amount",
      },
    },
    startDate: {
      type: Date,
      required: [true, "Start Date and Time is required"],
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry Date and Time is required"],
      
      validate: {
        validator: function (value) {
          return this.startDate ? value > this.startDate : true;
        },
        message: "Expiry Date must be after Start Date",
      },
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Used", "Redeemed", "Paused", "Reset"],
      required: [true, "Status is required"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    maxUsage: {
      type: Number,
      default: 1,
      min: [1, "Max usage must be at least 1"],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },

     createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    usageHistory: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        usedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["Used", "Redeemed"], default: "Used" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware: auto-set status to Inactive if expired
CouponSchema.pre("save", function (next) {
  if (this.expiryDate && this.expiryDate < new Date()) {
    this.status = "Inactive";
  }
  next();
});

// Method to reset coupon usage for a specific user
CouponSchema.methods.resetForUser = function (userId) {
  const index = this.usageHistory.findIndex(
    (u) => u.userId.toString() === userId.toString()
  );
  if (index !== -1) {
    this.usageHistory.splice(index, 1); // Remove user usage record
    this.usedCount = Math.max(this.usedCount - 1, 0); // Decrement usedCount safely
    this.markModified("usageHistory");
    return this.save();
  }
  return Promise.resolve(this); // Nothing to reset
};

// Unique indexes
CouponSchema.index({ couponCode: 1 }, { unique: true });
CouponSchema.index({ couponName: 1 }, { unique: true });

const CouponModel = mongoose.model("Coupon", CouponSchema);

module.exports = { CouponModel };
