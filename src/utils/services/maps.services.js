const axios = require("axios");
const { google_maps_api_key } = require("../../config/config");
const ApiError = require("../response/ApiError");
const statusCode = require("../constants/statusCode");
const BusRouteModel = require("../../models/bus-module/bus-routes/bus-routes.model");
const {
  AddressModel,
} = require("../../models/global-module/address/address.model");
const {
  hotelAddressModel,
} = require("../../models/hotel-module/hotel-registration/hotel-location.model");
const { translateLn } = require("./translator.service");

const getAddressCoordinate = async (address) => {
  const apiKey = google_maps_api_key;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  // console.log("get address coordinate", url)
  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      const location = response.data.results[0].geometry.location;
      return {
        ltd: location.lat,
        lng: location.lng,
      };
    } else {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Unable to fetch coordinates! Please enter valid address"
      );
    }
  } catch (error) {
    throw new ApiError(statusCode.NOT_FOUND, error);
  }
};

const getDistanceTime = async (pickup, drop) => {
  console.log("Pickup:", pickup, "Drop:", drop);
  if (!pickup || !drop) {
    throw new ApiError("Origin and destination are required");
  }

  const apiKey = google_maps_api_key;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(drop)}&key=${apiKey}`;
  // console.log("getDistanceTime", url)
  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      if (response.data.rows[0].elements[0].status === "ZERO_RESULTS") {
        throw new ApiError(statusCode.NOT_FOUND, "No routes found");
      }

      return response.data.rows[0].elements[0];
    } else {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Unable to fetch distance and time"
      );
    }
  } catch (error) {
    console.error(err);
    throw new ApiError(statusCode.NOT_FOUND, error);
  }
};

const getAutoCompleteSuggestions = async (input) => {
  const ln = req.get("ln") || "en";
  if (!input) {
    throw new ApiError(statusCode.BAD_REQUEST, "Query is required");
  }

  const apiKey = google_maps_api_key;
  const countries = [
    { code: "IN", name: "india" },
    { code: "CM", name: "cameroon" },
  ];

  try {
    let verifiedCities = [];

    for (const { code, name } of countries) {
      const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&components=country:${code}&key=${apiKey}`;

      const response = await axios.get(autoUrl);

      if (response.data.status === "OK" && response.data.predictions?.length) {
        for (const prediction of response.data.predictions) {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=address_components,name,formatted_address&key=${apiKey}`;

          try {
            const detailRes = await axios.get(detailsUrl);
            const result = detailRes.data.result;
            const components = result?.address_components || [];

            const country = components.find((c) => c.types.includes("country"));
            const locality =
              components.find((c) => c.types.includes("locality")) ||
              components.find((c) =>
                c.types.includes("administrative_area_level_2")
              );

            // ✅ Keep only results truly in India or Cameroon
            if (country && country.long_name.toLowerCase() === name) {
              // Prefer readable name or locality
              verifiedCities.push(
                result.name || locality?.long_name || prediction.description
              );
            }
          } catch {
            continue;
          }
        }
      }
    }

    const uniqueCities = [...new Set(verifiedCities)];

    if (!uniqueCities.length) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "NO_SERVICES_AVAILABLE")
      );
    }

    return uniqueCities;
  } catch (error) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      error.message || translateLn(ln, "NO_SERVICES_AVAILABLE")
    );
  }
};

const getDbAutoComplete = async (input, ln) => {
  if (!input) {
    throw new ApiError(statusCode.BAD_REQUEST, "Query is required");
  }

  try {
    const regex = new RegExp(`^${input}`, "i");

    // 1) Search Bus Route locations
    let busLocations = await BusRouteModel.find({
      $or: [
        { startLocation: regex },
        { endLocation: regex },
        { "pickups.name": regex },
        { "drops.name": regex },
      ],
    }).select("startLocation endLocation pickups drops");

    // Extract unique names
    let busNames = [];

    busLocations.forEach((r) => {
      if (regex.test(r.startLocation)) busNames.push(r.startLocation);
      if (regex.test(r.endLocation)) busNames.push(r.endLocation);

      r.pickups?.forEach((p) => {
        if (regex.test(p.name)) busNames.push(p.name);
      });
      r.drops?.forEach((d) => {
        if (regex.test(d.name)) busNames.push(d.name);
      });
    });

    // 2) Search Address table
    let addressData = await AddressModel.find({
      $or: [
        { townCity: regex },
        { area: regex },
        { locality: regex },
        { address: regex },
      ],
    }).select("townCity area locality address");

    let addressNames = [];
    addressData.forEach((a) => {
      if (regex.test(a.townCity)) addressNames.push(a.townCity);
      if (regex.test(a.area)) addressNames.push(a.area);
      if (regex.test(a.locality)) addressNames.push(a.locality);
      if (regex.test(a.address)) addressNames.push(a.address);
    });

    // 3) Combine all locations
    let combined = [...busNames, ...addressNames];

    // 4) Remove duplicates
    combined = [...new Set(combined.map((i) => i?.trim()))];

    // 5) If empty throw not found
    if (!combined.length) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "NO_SERVICES_AVAILABLE")
      );
    }

    return combined;
  } catch (error) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      error.message || translateLn(ln, "NO_SERVICES_AVAILABLE")
    );
  }
};

module.exports = { getAutoCompleteSuggestions, getDbAutoComplete };

// const getAutoCompleteSuggestions = async (input) => {
//   if (!input) {
//     throw new ApiError("query is required");
//   }

//   const apiKey = google_maps_api_key;
//   const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;

//   try {
//     const response = await axios.get(autoUrl);

//     if (response.data.status === "OK") {
//       const predictions = response.data.predictions;

//       const cityNames = await Promise.all(
//         predictions.map(async (prediction) => {
//           const placeId = prediction.place_id;
//           const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;

//           try {
//             const detailRes = await axios.get(detailsUrl);
//             const components = detailRes.data.result.address_components;

//             // Extract city name from address components
//             const cityComponent = components.find(comp =>
//               comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")
//             );
//             return cityComponent?.long_name || null;
//           } catch (err) {
//             return null;
//           }
//         })
//       );

//       // Filter out nulls and duplicates
//       const uniqueCities = [...new Set(cityNames.filter(Boolean))];
//       return uniqueCities;
//     } else {
//       throw new ApiError(statusCode.NOT_FOUND, "Unable to fetch suggestions");
//     }
//   } catch (error) {
//     throw new ApiError(statusCode.NOT_FOUND, error.message || error);
//   }
// };

// Api for cammeroon for searching  places
// const getAutoCompleteSuggestions = async (input) => {
//   if (!input) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Query is required");
//   }

//   const apiKey = google_maps_api_key;
//   const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
//     input
//   )}&components=country:IN&types=(cities)&key=${apiKey}`;

//   try {
//     // Step 1️⃣: Request Autocomplete restricted to Cameroon
//     const response = await axios.get(autoUrl);

//     if (response.data.status !== "OK" || !response.data.predictions?.length) {
//       throw new ApiError(statusCode.NOT_FOUND, "No services available in this area");
//     }

//     const verifiedCities = [];

//     // Step 2️⃣: Verify each prediction actually belongs to Cameroon
//     for (const prediction of response.data.predictions) {
//       const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=address_components,formatted_address&key=${apiKey}`;

//       try {
//         const detailRes = await axios.get(detailsUrl);
//         const result = detailRes.data.result;
//         const components = result?.address_components || [];

//         const country = components.find((c) => c.types.includes("country"));
//         const locality =
//           components.find((c) => c.types.includes("locality")) ||
//           components.find((c) => c.types.includes("administrative_area_level_2"));

//         // ✅ Only keep places truly in Cameroon and relevant to input
//         if (
//           country &&
//           country.long_name.toLowerCase() === "cameroon" &&
//           result.formatted_address.toLowerCase().includes(input.toLowerCase())
//         ) {
//           verifiedCities.push(locality?.long_name || prediction.description);
//         }
//       } catch {
//         continue;
//       }
//     }

//     // Step 3️⃣: Remove duplicates
//     const uniqueCities = [...new Set(verifiedCities)];

//     // Step 4️⃣: If nothing relevant, send “No services available”
//     if (!uniqueCities.length) {
//       throw new ApiError(statusCode.NOT_FOUND, "No services available in this area");
//     }

//     return uniqueCities;
//   } catch (error) {
//     throw new ApiError(
//       statusCode.NOT_FOUND,
//       "No services available in this area"
//     );
//   }
// };

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

module.exports = {
  getAddressCoordinate,
  getDbAutoComplete,
  getAutoCompleteSuggestions,
  getDistanceTime,
  calculateDistance,
};
