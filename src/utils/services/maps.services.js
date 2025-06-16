const axios = require("axios");
const { google_maps_api_key } = require("../../config/config");
const ApiError = require("../response/ApiError");
const statusCode = require("../constants/statusCode");


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
  if (!input) {
    throw new ApiError("query is required");
  }

  const apiKey = google_maps_api_key;
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;
  // console.log( "Suggestions",url)
  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      return response.data.predictions
        .map((prediction) => prediction.description)
        .filter((value) => value);
    } else {
      throw new ApiError(statusCode.NOT_FOUND, "Unable to fetch suggestions");
    }
  } catch (error) {
    throw new ApiError(statusCode.NOT_FOUND, error);
  }
};

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
  getAutoCompleteSuggestions,
  getDistanceTime,
  calculateDistance,
};
