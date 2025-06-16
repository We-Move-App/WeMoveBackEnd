const geolib = require("geolib");
const RideModel = require("../models/user-module/user-rides/user-ride.model");
const { getCaptainSocket } = require("./socketUtils");

const handleRideEvents = (socket, io, onDutyCaptains) => {
  let searchIntervals = new Map();

  socket.on("searchCaptain", async (rideId) => {
    try {
      //  rideId = rideId.rideId;
      const ride = await RideModel.findById(rideId.rideId).populate("user driver");
      console.log(ride);
      if (!ride) {
        socket.emit("error", { message: "Ride not found" });
        return;
      }

      const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;
      const SEARCH_RADIUS = 60000; // 60 km
      const MAX_RETRIES = 20;
      const RETRY_INTERVAL = 10000; // 10 seconds

      let retries = 0;
      let rideAccepted = false;
      let canceled = false;

      // Clean up any existing search for this ride
      if (searchIntervals.has(rideId)) {
        clearInterval(searchIntervals.get(rideId));
      }
      // console.log(onDutyCaptains);
      const findNearbyCaptains = () => {
        return Object.values(onDutyCaptains)
          .map((captain) => ({
            ...captain,
            distance: geolib.getDistance(captain.coords, {
              latitude: pickupLat,
              longitude: pickupLon,
            }),
          }))
          .filter((captain) => captain.distance <= SEARCH_RADIUS)
          .sort((a, b) => a.distance - b.distance);
      };

      const emitNearbyCaptains = () => {
        const nearbyCaptains = findNearbyCaptains();
        if (nearbyCaptains.length > 0) {
          console.log("NEARBY capt:", nearbyCaptains);
          socket.emit("nearbyCaptains", nearbyCaptains);
          nearbyCaptains.forEach((captain) => {
            socket.to(captain.socketId).emit("rideOffer", ride);
            console.log("Sent rideOffer to:", captain.socketId);
          });
        } else {
          console.log(`No captains nearby for ride ${rideId}, retrying...`);
        }
        return nearbyCaptains;
      };

      const stopSearch = () => {
        if (searchIntervals.has(rideId)) {
          clearInterval(searchIntervals.get(rideId));
          searchIntervals.delete(rideId);
        }
      };

      const retrySearch = async () => {
        retries++;
        if (canceled) return;

        const captains = emitNearbyCaptains();
        if (captains.length > 0 || retries >= MAX_RETRIES) {
          stopSearch();

          if (!rideAccepted && retries >= MAX_RETRIES) {
            await RideModel.findByIdAndDelete(rideId);
            socket.emit("error", {
              message: "No captains found for your ride within 5 minutes.",
            });
          }
        }
      };

      const retryInterval = setInterval(retrySearch, RETRY_INTERVAL);
      searchIntervals.set(rideId, retryInterval);

      // Handle ride acceptance
      const rideAcceptHandler = async () => {
        rideAccepted = true;
        stopSearch();
        socket.removeListener("rideAccepted", rideAcceptHandler);
        socket.removeListener("cancelRide", rideCancelHandler);
      };

      // Handle ride cancellation
      const rideCancelHandler = async () => {
        canceled = true;
        stopSearch();

        await RideModel.findByIdAndDelete(rideId);
        socket.emit("rideCanceled", {
          message: "Your ride has been canceled",
        });

        if (ride.driver) {
          const captainSocket = getCaptainSocket(io, ride.driver._id);
          if (captainSocket) {
            captainSocket.emit("rideCanceled", {
              message: `The ride with customer ${socket.user.id} has been canceled.`,
            });
          } else {
            console.log(`Captain not found for ride ${rideId}`);
          }
        } else {
          console.log(`No captain associated with ride ${rideId}`);
        }

        console.log(`Customer ${socket.user.id} canceled the ride ${rideId}`);

        socket.removeListener("rideAccepted", rideAcceptHandler);
        socket.removeListener("cancelRide", rideCancelHandler);
      };

      socket.on("rideAccepted", rideAcceptHandler);
      socket.on("cancelRide", rideCancelHandler);

      // Initial search
      retrySearch();

      // Clean up on disconnect
      const disconnectHandler = () => {
        stopSearch();
        socket.removeListener("rideAccepted", rideAcceptHandler);
        socket.removeListener("cancelRide", rideCancelHandler);
        socket.removeListener("disconnect", disconnectHandler);
      };

      socket.on("disconnect", disconnectHandler);

    } catch (error) {
      console.error("Error searching for captain:", error);
      socket.emit("error", { message: "Error searching for captain" });
    }
  });

  socket.on("subscribeRide", async (rideId) => {
    socket.join(`ride_${rideId}`);
    try {
      const rideData = await RideModel.findById(rideId.rideId).populate("user driver");
      socket.emit("rideData", rideData);
    } catch (error) {
      socket.emit("error", { message: "Failed to receive ride data" });
    }
  });

  // Clean up any remaining intervals on disconnect
  socket.on("disconnect", () => {
    for (const intervalId of searchIntervals.values()) {
      clearInterval(intervalId);
    }
    searchIntervals.clear();
  });
};

module.exports = handleRideEvents;