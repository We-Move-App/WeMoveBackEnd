const axios = require("axios");

const getDistanceAndDuration = async (
  pickupLocation,
  dropLocation,
  mode = "driving"
) => {
  if (
    !pickupLocation ||
    !dropLocation ||
    pickupLocation.lat == null ||
    pickupLocation.lng == null ||
    dropLocation.lat == null ||
    dropLocation.lng == null
  ) {
    throw new Error("Invalid pickup or drop location coordinates.");
  }

  const { lat: pickupLat, lng: pickupLng } = pickupLocation;
  const { lat: dropLat, lng: dropLng } = dropLocation;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pickupLat},${pickupLng}&destinations=${dropLat},${dropLng}&mode=${mode}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    console.log(
      `Google Maps API (${mode}) Response:`,
      JSON.stringify(data, null, 2)
    );

    if (
      data.status !== "OK" ||
      !data.rows[0]?.elements?.[0] ||
      data.rows[0].elements[0].status !== "OK"
    ) {
      // If the requested mode fails and it's not already "driving", fall back to driving
      if (mode !== "driving") {
        console.log(`Falling back to driving mode as ${mode} is not available`);
        return getDistanceAndDuration(pickupLocation, dropLocation, "driving");
      }
      throw new Error(
        `Failed to get ${mode} distance and duration from Google Maps.`
      );
    }

    const distanceInMeters = data.rows[0].elements[0].distance.value;
    const durationInSeconds = data.rows[0].elements[0].duration.value;

    return {
      distanceInKm: parseFloat((distanceInMeters / 1000).toFixed(2)),
      durationInMin: Math.ceil(durationInSeconds / 60),
    };
  } catch (error) {
    // If there's an API error and it's not already "driving", fall back to driving
    if (mode !== "driving") {
      console.log(
        `Falling back to driving mode due to API error: ${error.message}`
      );
      return getDistanceAndDuration(pickupLocation, dropLocation, "driving");
    }
    throw error;
  }
};

module.exports = getDistanceAndDuration;
