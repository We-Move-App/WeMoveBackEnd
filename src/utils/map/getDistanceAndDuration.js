const axios = require("axios");

const getDistanceAndDuration = async (pickupLocation, dropLocation) => {
  if (
    !pickupLocation || !dropLocation ||
    pickupLocation.lat == null || pickupLocation.lng == null ||
    dropLocation.lat == null || dropLocation.lng == null
  ) {
    throw new Error("Invalid pickup or drop location coordinates.");
  }

  const { lat: pickupLat, lng: pickupLng } = pickupLocation;
  const { lat: dropLat, lng: dropLng } = dropLocation;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pickupLat},${pickupLng}&destinations=${dropLat},${dropLng}&key=${apiKey}`;

  const response = await axios.get(url);
  const data = response.data;

  console.log("🧭 Google Maps API Response:", JSON.stringify(data, null, 2));

  if (
    data.status !== "OK" ||
    !data.rows[0]?.elements?.[0] ||
    data.rows[0].elements[0].status !== "OK"
  ) {
    throw new Error("Failed to get distance and duration from Google Maps.");
  }

  const distanceInMeters = data.rows[0].elements[0].distance.value;
  const durationInSeconds = data.rows[0].elements[0].duration.value;

  return {
    distanceInKm: parseFloat((distanceInMeters / 1000).toFixed(2)),
    durationInMin: Math.ceil(durationInSeconds / 60),
  };
};


module.exports = getDistanceAndDuration;
