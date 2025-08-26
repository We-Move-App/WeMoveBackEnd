const DriverLocation = require("../../models/new-driver-module/location/driver-location.model");
const { LocationStatusEnum } = require("../constants/ENUM");

// TODO : assigning more than 3KM

async function findNearbyDrivers(pickupCoords, vehicleType, maxDistanceKm = 3) {
  try {
    // Ensure coordinates are in [longitude, latitude] format for MongoDB
    const [lat, lng] = pickupCoords;
    const mongoCoords = [parseFloat(lng), parseFloat(lat)];
    
    console.log(`Searching for drivers near: ${mongoCoords}`);
    console.log(`Max distance: ${maxDistanceKm}km`);

    const nearbyDrivers = await DriverLocation.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: mongoCoords
          },
          distanceField: "distance",
          maxDistance: maxDistanceKm * 1000, // Convert km to meters
          spherical: true,
          query: { 
            status: LocationStatusEnum.ONLINE 
          }
        }
      },
      {
        $lookup: {
          from: "vehicledetails",
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicle"
        }
      },
      {
        $unwind: {
          path: "$vehicle",
          preserveNullAndEmptyArrays: false
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
          distance: { $divide: ["$distance", 1000] }, // Convert to km
          vehicleType: "$vehicle.vehicleType",
          vehicleId: "$vehicle._id"
        }
      },
      {
        $match: {
          distance: { $lte: maxDistanceKm } // Ensure we don't exceed max distance
        }
      }
    ]);

    console.log(`Found ${nearbyDrivers.length} drivers within ${maxDistanceKm}km`);
    return nearbyDrivers;
  } catch (error) {
    console.error("Error in findNearbyDrivers:", error);
    return [];
  }
}

module.exports=findNearbyDrivers