const mongoose = require("mongoose");

const priceBreakdownSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["TAXI", "BIKE", "BUS", "HOTEL"],
      required: true,
      uppercase: true,
    },
    commissionPercent: { type: Number, required: true },
    taxPercent: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, required: true, default: 0 },
    pricingRules: [
      {
        name: { type: String, required: true },
        timeRange: {
          startHour: { type: Number, required: true },
          endHour: { type: Number, required: true },
        },
        commissionPercent: { type: Number, required: true },
        baseFareIncreasePercent: { type: Number, default: 0 },
      },
    ],
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);
priceBreakdownSchema.methods.calculateFinalPrice = function (basePrice, time) {
  let { commissionPercent, taxPercent, discountPercent, pricingRules } = this;

  let originalPrice = basePrice;
  // 🔍 Get current time (hour)
  const currentHour = time.getHours();

  if (pricingRules.length > 0) {
    // 🔍 Find the applicable time slot
    const applicableRule = pricingRules.find(
      (rule) =>
        currentHour >= rule.timeRange.startHour &&
        currentHour < rule.timeRange.endHour
    );

    if (applicableRule) {
      commissionPercent = applicableRule.commissionPercent;
      basePrice += (basePrice * applicableRule.baseFareIncreasePercent) / 100;
    }
  }

  // 💰 Calculate Deduction
  const commissionAmount = (basePrice * commissionPercent) / 100;
  const taxAmount = (basePrice * taxPercent) / 100;
  const discountAmount = (basePrice * discountPercent) / 100;

  // 🎯 Final Price Calculation
  let finalAmount = basePrice + taxAmount + commissionAmount - discountAmount;
  finalAmount = finalAmount.toFixed(2)

  return {
    originalPrice: originalPrice,
    priceAfterIncrement: basePrice,
    commissionAmount,
    taxAmount,
    discountAmount,
    finalAmount,
  };
};

const PriceBreakdownModel = mongoose.model(
  "PriceBreakdown",
  priceBreakdownSchema
);

module.exports = PriceBreakdownModel;
