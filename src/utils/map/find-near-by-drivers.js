const DriverLocation = require("../../models/new-driver-module/location/driver-location.model");
const VehicleDetail = require("../../models/new-driver-module/vehicle-details/vehicle-details.model");
const { LocationStatusEnum } = require("../constants/ENUM");

async function findNearbyDrivers(pickupCoords, vehicleType) {
  // Try within 1km, then 3km
  const searchRadii = [1, 3];
  for (const radius of searchRadii) {
    const nearbyDrivers = await DriverLocation.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: pickupCoords },
          distanceField: "distance",
          maxDistance: radius * 1000, // convert km to meters
          spherical: true,
          query: { status: LocationStatusEnum.ONLINE }
        }
      },
      {
        $lookup: {
          from: "vehicledetails", // must match the collection name in DB
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicle"
        }
      },
      { $unwind: "$vehicle" },
      { $match: { "vehicle.vehicleType": vehicleType } },
      {
        $project: {
          driverId: 1,
          location: 1,
          distance: 1
        }
      }
    ]);

    if (nearbyDrivers.length > 0) {
      return nearbyDrivers;
    }
  }

  return []; // no drivers found
}

module.exports=findNearbyDrivers