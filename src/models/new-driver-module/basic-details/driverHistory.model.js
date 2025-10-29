const mongoose = require("mongoose");
const { Schema } = mongoose;

const driverHistorySchema = new Schema(
    {
        driverId: {
            type: String, // custom driverId, not ObjectId
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
            type: String, // could be 'driver' or 'admin'
            default: "driver",
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
driverHistorySchema.pre("save", function (next) {
    if (this.previousEmail) this.previousEmail = this.previousEmail.toLowerCase();
    if (this.newEmail) this.newEmail = this.newEmail.toLowerCase();
    next();
});

// Validation: at least one change should exist
driverHistorySchema.pre("validate", function (next) {
    if (
        !this.previousEmail &&
        !this.newEmail &&
        !this.previousPhoneNumber &&
        !this.newPhoneNumber
    ) {
        return next(new Error("At least one of previous/new email or phone must be provided"));
    }
    next();
});

// Index for fast lookups
driverHistorySchema.index({ previousEmail: 1 });
driverHistorySchema.index({ newEmail: 1 });
driverHistorySchema.index({ previousPhoneNumber: 1 });
driverHistorySchema.index({ newPhoneNumber: 1 });
driverHistorySchema.index({ driverId: 1, changedAt: -1 });

module.exports = mongoose.model("DriverHistory", driverHistorySchema);
