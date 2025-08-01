const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");
const { Schema } = mongoose;

const BusSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "BusOperator",
      required: true,
    },
    busName: {
      type: String,
      required: true,
      trim: true,
    },
    busRegNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    busModelNumber: {
      type: String,
      required: true,
      trim: true,
    },
    routes: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
    },
    assignedDriver:[ {
      type: Schema.Types.ObjectId,
      ref: "BusDriver",
      default: null,
    }],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isComplete:{
      type: Boolean,
      default: false,
    },
 

    amenities: [
      {
        _id: false,
        name: { type: String },
        status: {
          type: Boolean,
          enum: ["true", "false"],
          default: "true",
        },
      },
    ],
    runningDays: {
      type: [String],
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      default: [],
    },
    busLicenseFront: {
      type: ImageSchema,
    },
   rating: {
  type: Number,
  min: 0,
  max: 5,
  default: 0,
  get: (val) => Math.round(val * 10) / 10,
  set: (val) => Math.min(Math.max(val, 0), 5),
},
ratingCount: {
  type: Number,
  default: 0,
  min: 0,
},

    noOfSeats: {
      type: Number,
      min: 1,
      max: 200,
    },
    busImages: {
      type: Schema.Types.ObjectId,
      ref: "BusImage",
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

BusSchema.index({ ownerId: 1 });
BusSchema.index({ status: 1 });
BusSchema.index({ rating: -1 })
const BusModel = mongoose.model("Bus", BusSchema);
module.exports = BusModel;
