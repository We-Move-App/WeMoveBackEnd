const mongoose = require("mongoose");
const { Schema } = mongoose;

const busOperatorHistorySchema = new Schema(
    {
        busOperatorId: {
            type: Schema.Types.ObjectId,
            ref: "BusOperator",
            required: true,
            index: true,
        },
        previousEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        newEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        previousPhoneNumber: {
            type: String,
            trim: true,
        },
        newPhoneNumber: {
            type: String,
            trim: true,
        },
        changedBy: {
            type: Schema.Types.ObjectId,
            ref: "BusOperator", 
        },
        changedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

//
// 🔹 Normalize emails before save
//
busOperatorHistorySchema.pre("save", function (next) {
    if (this.previousEmail) this.previousEmail = this.previousEmail.toLowerCase();
    if (this.newEmail) this.newEmail = this.newEmail.toLowerCase();
    next();
});

//
// 🔹 Validation: ensure at least one field changed
//
busOperatorHistorySchema.pre("validate", function (next) {
    const hasChange =
        this.previousEmail ||
        this.newEmail ||
        this.previousPhoneNumber ||
        this.newPhoneNumber;

    if (!hasChange) {
        return next(new Error("At least one of previous/new email or phone must be provided."));
    }

    next();
});

//
// 🔹 Helpful indexes for quick lookups
//
busOperatorHistorySchema.index({ previousEmail: 1 });
busOperatorHistorySchema.index({ newEmail: 1 });
busOperatorHistorySchema.index({ previousPhoneNumber: 1 });
busOperatorHistorySchema.index({ newPhoneNumber: 1 });
busOperatorHistorySchema.index({ busOperatorId: 1, changedAt: -1 });

//
// 🔹 Export Model
//
module.exports = mongoose.model("BusOperatorHistory", busOperatorHistorySchema);
