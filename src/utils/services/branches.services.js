const geolib = require("geolib");
const {
  BranchModel,
} = require("../../models/admin-module/branch/branches.model");

const haversine = (lat1, lon1, lat2, lon2) => {
  const toRad = (angle) => (angle * Math.PI) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Using Haversine
const assignUserToBranch = async (userLat, userLon) => {
  let nearestBranch = null;
  let minDistance = Infinity;

  const branches = await BranchModel.find();

  branches?.forEach((branch) => {
    const distance = haversine(
      userLat,
      userLon,
      branch.coordinates?.latitude,
      branch.coordinates?.longitude
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestBranch = branch;
    }
  });

  return nearestBranch && minDistance <= 5
    ? nearestBranch
    : "No nearby branch found";
};

const assignBranchToUserUsingGeolib = async (userLat, userLon) => {
  const branches = await BranchModel.find();

  const validBranches = branches
    .filter(
      (branch) => branch.coordinates?.latitude && branch.coordinates?.longitude
    )
    .map((branch) => ({
      latitude: branch.coordinates.latitude,
      longitude: branch.coordinates.longitude,
      name: branch.name,
      _id: branch._id,
    }));

  let nearest = null;
  let minDistance = Infinity;

  validBranches.forEach((branch) => {
    const dist = geolib.getDistance(
      { latitude: userLat, longitude: userLon },
      { latitude: branch.latitude, longitude: branch.longitude }
    );

    const distKm = dist / 1000;
    console.log(`Branch: ${branch.name}, Distance: ${distKm.toFixed(2)} km`);

    if (dist < minDistance) {
      minDistance = dist;
      nearest = branch;
    }
  });

  const distanceInKm = minDistance / 1000;

  if (distanceInKm <= 50) {
    return {
      nearest,
      distanceInKm,
      success: true,
      message: "Assign Successfully",
    };
  } else {
    return {
      success: false,
      nearest,
      distanceInKm,
      message: `Nearest branch is too far (${distanceInKm.toFixed(2)} km)`,
    };
  }
};




module.exports = {
  assignUserToBranch,
  assignBranchToUserUsingGeolib,
};
