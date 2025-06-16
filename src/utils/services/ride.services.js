const DriverModel = require("../../models/driver-module/drivers/drivers.model");
const RideModel = require("../../models/user-module/user-rides/user-ride.model");
const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const { getFinalPrice } = require("./prices.services");

const calculateFare = (distance, vehicle, subType) => {
  const rateStructure = {
    bike: {
      scooter: { baseFare: 8, perKmRate: 4, minimumFare: 20 },
      motorbike: { baseFare: 10, perKmRate: 5, minimumFare: 25 },
    },
    taxi: {
      sedan: { baseFare: 25, perKmRate: 12, minimumFare: 60 },
      mini: { baseFare: 20, perKmRate: 10, minimumFare: 50 },
      economy: { baseFare: 15, perKmRate: 8, minimumFare: 40 },
    },
  };

  if (!rateStructure[vehicle] || !rateStructure[vehicle][subType]) {
    throw new Error(`Invalid vehicle or subtype: ${vehicle}, ${subType}`);
  }

  const { baseFare, perKmRate, minimumFare } = rateStructure[vehicle][subType];
  const calculatedFare = baseFare + distance * perKmRate;

  return Math.max(calculatedFare, minimumFare);
};

const calculateFareForVehicle = async (distance, vehicle) => {
  if (!distance || !vehicle) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Distance and vehicle are required"
    );
  }

  const vehicleTypeUpper = vehicle.toUpperCase();

  const rateStructure = {
    bike: {
      scooter: { baseFare: 8, perKmRate: 4, minimumFare: 20 },
      motorbike: { baseFare: 10, perKmRate: 5, minimumFare: 25 },
    },
    taxi: {
      sedan: { baseFare: 25, perKmRate: 12, minimumFare: 60 },
      mini: { baseFare: 20, perKmRate: 10, minimumFare: 50 },
      economy: { baseFare: 15, perKmRate: 8, minimumFare: 40 },
    },
  };

  if (!rateStructure[vehicle]) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid vehicle type: ${vehicle}`
    );
  }

  const vehicleType = rateStructure[vehicle];

  const fareDetails = await Promise.all(
    Object.keys(vehicleType).map(async (subType) => {
      const { baseFare, perKmRate, minimumFare } = vehicleType[subType];
      const calculatedFare = baseFare + distance * perKmRate;
      const ridePrice = Math.max(calculatedFare, minimumFare).toFixed(1);

      const updatedFare = await getFinalPrice(
        vehicleTypeUpper,
        parseFloat(ridePrice),
        new Date()
      );

      return {
        vehicle: subType,
        fare: updatedFare,
      };
    })
  );

  return fareDetails;
};



// SEACHING FOR DRVIER
const searchForDriver = async (rideId, attempts = 3, delay = 10000) => {
  for (let i = 0; i < attempts; i++) {
    console.log(`Searching for a driver... Attempt ${i + 1}/${attempts}`);

    const ride = await RideModel.findById(rideId);
    if (!ride || ride.status !== "SEARCHING_FOR_CAPTAIN") return;

    // Find the nearest available driver
    const availableDriver = await DriverModel.findOne({ isAvailable: true });

    if (availableDriver) {
      console.log(`Driver found: ${availableDriver._id}`);

      // Assign driver to ride
      await RideModel.findByIdAndUpdate(rideId, {
        driver: availableDriver._id,
        status: "START",
      });

      // Mark the driver as unavailable
      await DriverModel.findByIdAndUpdate(availableDriver._id, {
        isAvailable: false,
      });

      return;
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.log(`No driver found after ${attempts} attempts. Cancelling ride...`);
  await RideModel.findByIdAndUpdate(rideId, {
    status: "CANCELLED",
    cancelReason: "Due to no driver found",
  });
};

module.exports = { calculateFare, calculateFareForVehicle };
