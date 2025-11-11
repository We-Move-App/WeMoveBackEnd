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


  console.log("Requested mode:", "Amit");
  //Testing for India restriction Api
  const allowedCountry = ["IN", "CM"]; // India and Cameroon

  const { lat: pickupLat, lng: pickupLng } = pickupLocation;
  const { lat: dropLat, lng: dropLng } = dropLocation;

  const isLatLngInCameroon = async (lat, lng) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const resp = await axios.get(url);
      const results = resp.data.results || [];

      for (const r of results) {
        const countryComp = (r.address_components || []).find((c) =>
          c.types && c.types.includes("country")
        );
        if (countryComp && allowedCountry.includes(countryComp.short_name)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Reverse geocode error:", err.message);
      return false;
    }
  };
  // Verify both pickup and drop locations are in Cameroon
  const pickupInCameroon = await isLatLngInCameroon(pickupLat, pickupLng);
  const dropInCameroon = await isLatLngInCameroon(dropLat, dropLng);
  if (!pickupInCameroon || !dropInCameroon) {
    return {
      success: false,
      message: "Service not available in this region (outside Cameroon and India).",
    };
  }


  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pickupLat},${pickupLng}&destinations=${dropLat},${dropLng}&mode=${mode}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

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

//for India restriction Api Testing purpose
// const getAutocomplete = async (input, lat = null, lng = null) => {
//   // const apiKey = process.env.GOOGLE_MAPS_API_KEY;

//   let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&key=${apiKey}`;

//   if (lat && lng) {
//     url += `&location=${lat},${lng}&radius=10000`;
//   }

//   try {
//     const response = await axios.get(url);

//     if (response.data.status !== "OK") {
//       throw new Error(`Google API Error: ${response.data.status}`);
//     }

//     const filteredPlaces = response.data.predictions.map((place) => ({
//       description: place.description,
//       place_id: place.place_id,
//       main_text: place.structured_formatting?.main_text || "",
//       secondaryText: place.structured_formatting?.secondary_text || "",
//     }));

//     return filteredPlaces;
//   } catch (error) {
//     console.error("Get Autocomplete Error:", error.message);
//     throw new Error("Failed to fetch autocomplete places");
//   }
// };

// helper: verify lat/lng are inside Cameroon using Geocoding API
async function isLatLngInCameroon(lat, lng) {
  if (!lat || !lng) return false;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const resp = await axios.get(url);
    const results = resp.data.results || [];
    for (const r of results) {
      const countryComp = (r.address_components || []).find((c) =>
        c.types && c.types.includes("country")
      );
      if (countryComp && countryComp.short_name === "CM") return true;
    }
    return false;
  } catch (err) {
    console.error("Reverse geocode error:", err.message);
    // be conservative: treat failure as outside
    return false;
  }
}
// for Camerron  restriction Api 
// const getAutocomplete = async (input, lat = null, lng = null) => {

//   const baseUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;

//   // If lat/lng provided, ensure they are valid decimal numbers
//   const latNum = lat ? Number(lat) : null;
//   const lngNum = lng ? Number(lng) : null;

//   // If lat/lng present but not valid numbers -> reject early
//   if ((lat && !latNum && latNum !== 0) || (lng && !lngNum && lngNum !== 0)) {
//     return { message: "No services available", places: [] };
//   }

//   // If lat/lng provided -> verify they are inside Cameroon
//   if (latNum !== null && lngNum !== null) {
//     const insideCM = await isLatLngInCameroon(latNum, lngNum);
//     if (!insideCM) {
//       // coordinates are outside Cameroon -> return no service
//       return { message: "No services available", places: [] };
//     }
//   }

//   // Build autocomplete URL (Cameroon only)
//   let url = `${baseUrl}?input=${encodeURIComponent(input)}&components=country:CM&key=${apiKey}`;

//   if (latNum !== null && lngNum !== null) {
//     // include location bias only when lat/lng are valid and inside Cameroon
//     url += `&location=${latNum},${lngNum}&radius=10000`;
//   }

//   try {
//     const response = await axios.get(url);
//     const { status, predictions } = response.data;

//     if (status !== "OK" || !predictions || !predictions.length) {
//       return { message: "No services available", places: [] };
//     }

//     const filteredPlaces = predictions
//       .filter((p) => p.description.toLowerCase().includes("cameroon"))
//       .map((place) => ({
//         description: place.description,
//         place_id: place.place_id,
//         main_text: place.structured_formatting?.main_text || "",
//         secondaryText: place.structured_formatting?.secondary_text || "",
//       }));

//     if (!filteredPlaces.length) {
//       return { message: "No services available", places: [] };
//     }

//     return { message: "Places fetched successfully", places: filteredPlaces };
//   } catch (error) {
//     console.error("Get Autocomplete Error:", error.message);
//     throw new Error("Failed to fetch autocomplete places");
//   }
// };

//for both India and Cameroon restriction Api

const getAutocomplete = async (input, lat = null, lng = null) => {
  const baseUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 🌍 Allowed countries: Cameroon + India
  const allowedCountries = ["CM", "IN"];

  // Convert lat/lng safely
  const latNum = lat ? Number(lat) : null;
  const lngNum = lng ? Number(lng) : null;

  // Invalid lat/lng check
  if ((lat && isNaN(latNum)) || (lng && isNaN(lngNum))) {
    return { message: "No services available", places: [] };
  }

  // 🧭 Helper: detect if lat/lng are inside India or Cameroon
  const isLatLngInAllowedCountry = async (lat, lng) => {
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const resp = await axios.get(geoUrl);
      const results = resp.data.results || [];

      for (const r of results) {
        const countryComp = (r.address_components || []).find((c) =>
          c.types.includes("country")
        );
        if (countryComp && allowedCountries.includes(countryComp.short_name)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Reverse geocode error:", err.message);
      return false;
    }
  };

  // 🧩 Verify if provided coordinates are inside allowed region
  if (latNum !== null && lngNum !== null) {
    const insideAllowed = await isLatLngInAllowedCountry(latNum, lngNum);
    if (!insideAllowed) {
      return { message: "No services available (outside allowed countries)", places: [] };
    }
  }

  // 🗺️ Build autocomplete URL with India + Cameroon restriction
  // Note: Google API doesn't support multiple countries directly — so we’ll default to India for test when lat/lng are in India, else Cameroon.
  let countryCode = "CM";
  if (latNum !== null && lngNum !== null) {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${apiKey}`;
    const resp = await axios.get(geoUrl);
    const countryComp = resp.data.results?.[0]?.address_components?.find((c) =>
      c.types.includes("country")
    );
    if (countryComp && allowedCountries.includes(countryComp.short_name)) {
      countryCode = countryComp.short_name;
    }
  }

  let url = `${baseUrl}?input=${encodeURIComponent(input)}&components=country:${countryCode}&key=${apiKey}`;

  if (latNum !== null && lngNum !== null) {
    url += `&location=${latNum},${lngNum}&radius=10000`;
  }

  try {
    const response = await axios.get(url);
    const { status, predictions } = response.data;

    if (status !== "OK" || !predictions || !predictions.length) {
      return { message: "No services available", places: [] };
    }

    // 🧹 Filter: keep only results that belong to India or Cameroon
    const filteredPlaces = predictions
      .filter((p) => {
        const desc = p.description.toLowerCase();
        return desc.includes("cameroon") || desc.includes("india");
      })
      .map((place) => ({
        description: place.description,
        place_id: place.place_id,
        main_text: place.structured_formatting?.main_text || "",
        secondaryText: place.structured_formatting?.secondary_text || "",
      }));

    if (!filteredPlaces.length) {
      return { message: "No services available", places: [] };
    }

    return { message: "Places fetched successfully", places: filteredPlaces };
  } catch (error) {
    console.error("Get Autocomplete Error:", error.message);
    throw new Error("Failed to fetch autocomplete places");
  }
};

// const getAddressFromCoordinates = async (lat, lng) => {
//   // const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

//   try {
//     const response = await axios.get(url);

//     if (response.data.status !== "OK") {
//       throw new Error(`Google API Error: ${response.data.status}`);
//     }

//     const results = response.data.results;
//     const address = results.length > 0 ? results[0].formatted_address : null;

//     return address;
//   } catch (error) {
//     console.error("Get Address Error:", error.response?.data || error.message);
//     throw new Error("Failed to fetch address from coordinates");
//   }
// };

//Api restriction for Cameroon and India
const getAddressFromCoordinates = async (lat, lng) => {
  if (!lat || !lng) {
    throw new Error("Latitude and Longitude are required");
  }

  const allowedCountries = ["IN", "CM"]; // India and Cameroon only
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    if (response.data.status !== "OK") {
      throw new Error(`Google API Error: ${response.data.status}`);
    }

    const results = response.data.results || [];
    if (results.length === 0) {
      return {
        success: false,
        message: "No address found for these coordinates.",
      };
    }

    // Extract the country from the results
    let countryCode = null;
    for (const r of results) {
      const countryComp = (r.address_components || []).find((c) =>
        c.types && c.types.includes("country")
      );
      if (countryComp) {
        countryCode = countryComp.short_name;
        break;
      }
    }

    // ✅ Restriction check
    if (!allowedCountries.includes(countryCode)) {
      return {
        success: false,
        message: "Service not available in this region (outside Cameroon and India).",
      };
    }

    // ✅ Return formatted address if valid
    const address = results[0].formatted_address;
    return {
      success: true,
      countryCode,
      address,
    };
  } catch (error) {
    console.error("Get Address Error:", error.response?.data || error.message);
    throw new Error("Failed to fetch address from coordinates");
  }
};

// const getDirections = async (origin, destination) => {
//   // const apiKey = process.env.GOOGLE_MAPS_API_KEY;

//   const originKey = origin.trim();
//   const destinationKey = destination.trim();

//   const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originKey}&destination=${destinationKey}&key=${apiKey}`;

//   try {
//     const response = await axios.get(url);

//     if (response.data.status !== "OK") {
//       throw new Error(`Google Directions API Error: ${response.data.status}`);
//     }

//     const route = response.data.routes?.[0];
//     const leg = route?.legs?.[0];

//     if (!route || !leg) {
//       throw new Error("No valid route found between the specified points.");
//     }

//     const trimmedData = {
//       distance: leg.distance,
//       duration: leg.duration,
//       start_location: leg.start_location,
//       end_location: leg.end_location,
//       polyline: route.overview_polyline?.points || "",
//     };

//     return trimmedData;
//   } catch (error) {
//     console.error("Get Directions Error:", error.message);
//     throw new Error("Failed to fetch directions");
//   }
// };




//Api restriction for Cameroon and India



const getDirections = async (origin, destination) => {
  if (!origin || !destination) {
    throw new Error("Origin and destination are required");
  }

  const allowedCountries = ["IN", "CM"]; // India and Cameroon

  // Helper: Verify if a place (string) belongs to India or Cameroon
  const getCountryFromPlace = async (place) => {
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        place
      )}&key=${apiKey}`;

      const resp = await axios.get(geoUrl);
      const results = resp.data.results || [];

      for (const r of results) {
        const countryComp = (r.address_components || []).find((c) =>
          c.types && c.types.includes("country")
        );
        if (countryComp) {
          return countryComp.short_name; // e.g., "IN" or "CM"
        }
      }
      return null;
    } catch (err) {
      console.error("Error fetching country:", err.message);
      return null;
    }
  };

  // Step 1️⃣: Validate both origin and destination countries
  const originCountry = await getCountryFromPlace(origin);
  const destCountry = await getCountryFromPlace(destination);

  if (
    !allowedCountries.includes(originCountry) ||
    !allowedCountries.includes(destCountry)
  ) {
    return {
      success: false,
      message:
        "Service not available in this region (outside Cameroon and India).",
    };
  }

  // Step 2️⃣: Call Directions API
  const originKey = origin.trim();
  const destinationKey = destination.trim();

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    originKey
  )}&destination=${encodeURIComponent(destinationKey)}&key=${apiKey}`;

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
      success: true,
      message: "Directions fetched successfully",
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

const getPlaceDetails = async (placeId) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    if (response.data.status !== "OK") {
      throw new Error(`Google Place Details API Error: ${response.data.status}`);
    }

    const result = response.data.result;

    if (!result) {
      throw new Error("No details found for the given Place ID.");
    }

    const trimmedData = {
      name: result.name,
      address: result.formatted_address,
      location: result.geometry?.location || {},
      place_id: result.place_id,
      types: result.types || [],
      phoneNumber: result.formatted_phone_number || null,
      rating: result.rating || null,
      website: result.website || null,
    };

    return trimmedData;
  } catch (error) {
    console.error("Get Place Details Error:", error.message);
    throw new Error("Failed to fetch place details");
  }
};


// const getPlaceDetails = async (placeId) => {
//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;

//   // 🧭 Define which countries you allow (India + Cameroon)
//   const allowedCountries = ["IN", "CM"];

//   try {
//     // Step 1️⃣ — Fetch Place Details
//     const placeUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;
//     const response = await axios.get(placeUrl);

//     if (response.data.status !== "OK") {
//       throw new Error(`Google Place Details API Error: ${response.data.status}`);
//     }

//     const result = response.data.result;
//     if (!result) {
//       throw new Error("No details found for the given Place ID.");
//     }

//     const { lat, lng } = result.geometry?.location || {};

//     if (!lat || !lng) {
//       throw new Error("No coordinates found for the given Place ID.");
//     }

//     // Step 2️⃣ — Reverse geocode to find the country
//     const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
//     const geoResponse = await axios.get(geoUrl);
//     const geoResults = geoResponse.data.results || [];

//     let countryCode = null;
//     for (const res of geoResults) {
//       const country = (res.address_components || []).find((c) =>
//         c.types.includes("country")
//       );
//       if (country) {
//         countryCode = country.short_name;
//         break;
//       }
//     }

//     // Step 3️⃣ — Check restriction
//     if (!allowedCountries.includes(countryCode)) {
//       return {
//         success: false,
//         message: `❌ Service not available in this region (${countryCode}). Allowed: ${allowedCountries.join(", ")}.`,
//       };
//     }

//     // Step 4️⃣ — Build response
//     const trimmedData = {
//       success: true,
//       name: result.name,
//       address: result.formatted_address,
//       location: result.geometry?.location || {},
//       place_id: result.place_id,
//       types: result.types || [],
//       phoneNumber: result.formatted_phone_number || null,
//       rating: result.rating || null,
//       website: result.website || null,
//       country: countryCode,
//     };

//     return trimmedData;
//   } catch (error) {
//     console.error("Get Place Details Error:", error.message);
//     throw new Error("Failed to fetch place details");
//   }
// };


module.exports = {
  getDistanceAndDuration,
  getAutocomplete,
  getAddressFromCoordinates,
  getDirections,
  getPlaceDetails
};
