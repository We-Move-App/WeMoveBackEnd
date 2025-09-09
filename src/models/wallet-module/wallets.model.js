const mongoose = require("mongoose");
const { WalletCurrencyEnum } = require("../../utils/constants/ENUM");

function truncateToTwo(v) {
  if (v === null || v === undefined || v === "") return v;
  const num = Number(v);
  if (!isFinite(num)) return v;
  return Math.trunc(num * 100) / 100;
}

const walletSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    balance: {
      type: Number,
      default: 0,
      min: 0,
      set: truncateToTwo, // <-- truncates when value is set on the document
    },
    currency: {
      type: String,
      enum: WalletCurrencyEnum,
      default: process.env.MOMO_CURRENCY,
    },
    cardNumber: { type: String, index: true },
  },
  { timestamps: true }
);

async function truncateBalanceInUpdate(next) {
  try {
    const update = this.getUpdate();
    if (!update) return next();

    if (update.$set && update.$set.balance != null) {
      update.$set.balance = truncateToTwo(update.$set.balance);
      this.setUpdate(update);
      return next();
    }

    if (update.balance != null) {
      update.balance = truncateToTwo(update.balance);
      this.setUpdate(update);
      return next();
    }

    if (update.$inc && update.$inc.balance != null) {
      const incVal = Number(update.$inc.balance);
      const doc = await this.model
        .findOne(this.getQuery())
        .select("balance")
        .lean();
      const current = doc && doc.balance != null ? Number(doc.balance) : 0;
      const final = truncateToTwo(current + incVal);

      const remainingInc = { ...update.$inc };
      delete remainingInc.balance;

      const newUpdate = { ...update };
      delete newUpdate.$inc;
      if (Object.keys(remainingInc).length) newUpdate.$inc = remainingInc;
      newUpdate.$set = { ...(newUpdate.$set || {}), balance: final };

      this.setUpdate(newUpdate);
      return next();
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

walletSchema.pre("findOneAndUpdate", truncateBalanceInUpdate);
walletSchema.pre("updateOne", truncateBalanceInUpdate);

module.exports = mongoose.model("Wallet", walletSchema);
