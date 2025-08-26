const mongoose = require("mongoose");
const {
  CommissionServiceTypeEnum,
  CommissionTypeEnum,
  CommissionStatusEnum,
} = require("../../../utils/constants/ENUM");

const commissionSchema = new mongoose.Schema(
  {
    serviceType: { type: String, enum: CommissionServiceTypeEnum },
    commissionType: { type: String, enum: CommissionTypeEnum },
    commissionPercentage: { type: Number, min: 0, max: 100, default: null },
    commissionRate: { type: Number, default: null },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: CommissionStatusEnum,
      default: CommissionStatusEnum.ACTIVE,
    },
  },
  { timestamps: true }
);

const Commission = mongoose.model("Commission", commissionSchema);
module.exports = Commission;
