const axios = require("axios");
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

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

const getAutocomplete = async (input, lat = null, lng = null) => {
  // const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&key=${apiKey}`;

  if (lat && lng) {
    url += `&location=${lat},${lng}&radius=10000`;
  }

  try {
    const response = await axios.get(url);

    if (response.data.status !== "OK") {
      throw new Error(`Google API Error: ${response.data.status}`);
    }

    const filteredPlaces = response.data.predictions.map((place) => ({
      description: place.description,
      place_id: place.place_id,
      main_text: place.structured_formatting?.main_text || "",
      secondaryText: place.structured_formatting?.secondary_text || "",
    }));

    return filteredPlaces;
  } catch (error) {
    console.error("Get Autocomplete Error:", error.message);
    throw new Error("Failed to fetch autocomplete places");
  }
};

const getAddressFromCoordinates = async (lat, lng) => {
  // const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    if (response.data.status !== "OK") {
      throw new Error(`Google API Error: ${response.data.status}`);
    }

    const results = response.data.results;
    const address = results.length > 0 ? results[0].formatted_address : null;

    return address;
  } catch (error) {
    console.error("Get Address Error:", error.response?.data || error.message);
    throw new Error("Failed to fetch address from coordinates");
  }
};

const getDirections = async (origin, destination) => {
  // const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const originKey = origin.trim();
  const destinationKey = destination.trim();

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originKey}&destination=${destinationKey}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    if (response.data.status !== "OK") {
      throw new Error(`Google Directions API Error: ${response.data.status}`);
    }

    const route = response.data.routes?.[0];
    const leg = route?.legs?.[0];

    if (!route || !leg) {
      throw new Error("No valid route found between the specified points.");
    }

    const trimmedData = {
      distance: leg.distance,
      duration: leg.duration,
      start_location: leg.start_location,
      end_location: leg.end_location,
      polyline: route.overview_polyline?.points || "",
    };

    return trimmedData;
  } catch (error) {
    console.error("Get Directions Error:", error.message);
    throw new Error("Failed to fetch directions");
  }
};

module.exports = {
  getDistanceAndDuration,
  getAutocomplete,
  getAddressFromCoordinates,
  getDirections
};
