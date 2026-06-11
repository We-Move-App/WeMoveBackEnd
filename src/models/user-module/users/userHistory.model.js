const mongoose = require("mongoose");
const { Schema } = mongoose;

const userHistorySchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
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
            ref: "User",
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

// Normalize emails
userHistorySchema.pre("save", function (next) {
    if (this.previousEmail) this.previousEmail = this.previousEmail.toLowerCase();
    if (this.newEmail) this.newEmail = this.newEmail.toLowerCase();
    next();
});

// Validation: at least one change should exist
userHistorySchema.pre("validate", function (next) {
    if (
        !this.previousEmail && !this.newEmail &&
        !this.previousPhoneNumber && !this.newPhoneNumber
    ) {
        return next(new Error("At least one of previous/new email or phone must be provided"));
    }
    next();
});

// Index for fast lookups
userHistorySchema.index({ previousEmail: 1 });
userHistorySchema.index({ newEmail: 1 });
userHistorySchema.index({ previousPhoneNumber: 1 });
userHistorySchema.index({ newPhoneNumber: 1 });
userHistorySchema.index({ userId: 1, changedAt: -1 });

module.exports = mongoose.model("UserHistory", userHistorySchema);
