const DriverLocation = require("../../models/new-driver-module/location/driver-location.model");
const { LocationStatusEnum } = require("../constants/ENUM");

async function findNearbyDrivers(pickupCoords, vehicleType) {
  // Swap [lat, lng] → [lng, lat]
  const [lat, lng] = pickupCoords;
  const mongoCoords = [lng, lat];

  // Radii to try in km
  const searchRadii = [1, 3];

  for (const radius of searchRadii) {
    const nearbyDrivers = await DriverLocation.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: mongoCoords // swapped coordinates
          },
          distanceField: "distance",
          maxDistance: radius * 1000, // meters
          spherical: true,
          query: { status: LocationStatusEnum.ONLINE }
        }
      },
      {
        $lookup: {
          from: "vehicledetails", // lowercase collection name
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicle"
        }
      },
      {
        $unwind: {
          path: "$vehicle",
          preserveNullAndEmptyArrays: false // remove drivers without vehicle
        }
      },
      {
        $match: {
          "vehicle.vehicleType": vehicleType
        }
      },
      {
        $project: {
          driverId: 1,
          location: 1,
          distance: 1,
          vehicleType: "$vehicle.vehicleType",
          vehicleId: "$vehicle._id"
        }
      }
    ]);

    if (nearbyDrivers.length > 0) {
      return nearbyDrivers;
    }
  }

  return [];
}

module.exports=findNearbyDrivers