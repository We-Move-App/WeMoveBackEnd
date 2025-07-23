const { io } = require("socket.io-client");

const DRIVER_ID = "driver123";
const USER_ID = "6859365f0b2fe832f227e336";
const BOOKING_ID = "BOOKING126";

// Coordinates for MG Road → Koramangala, Bengaluru
const pickupLocation = {
  lat: 12.9716,
  lng: 77.5946,
  address: "MG Road, Bengaluru"
};

const dropLocation = {
  lat: 12.9352,
  lng: 77.6146,
  address: "Koramangala, Bengaluru"
};

// Connect as Driver
const driverSocket = io("http://localhost:8000/driver", {
  auth: { driverId: DRIVER_ID },
});

driverSocket.on("connect", () => {
  console.log("🚗 Driver connected:", driverSocket.id);

  // Emit location update
  driverSocket.emit("driver:locationUpdate", { lat: pickupLocation.lat, lng: pickupLocation.lng }, (res) => {
    console.log("📍 Driver location update ACK:", res);
  });

  // Accept ride after a short delay
  setTimeout(() => {
    driverSocket.emit("ride:accept", { bookingId: BOOKING_ID }, (res) => {
      console.log("✅ Ride accepted ACK:", res);
    });
  }, 3000);

  // Start ride after another delay
  setTimeout(() => {
    driverSocket.emit("ride:start", { bookingId: BOOKING_ID }, (res) => {
      console.log("🏁 Ride started ACK:", res);
    });
  }, 6000);

  // Complete ride
  setTimeout(() => {
    driverSocket.emit("ride:complete", { bookingId: BOOKING_ID }, (res) => {
      console.log("✅ Ride completed ACK:", res);
    });
  }, 9000);
});

driverSocket.on("disconnect", () => {
  console.log("❌ Driver disconnected");
});

driverSocket.on("ride:incomingRequest", (data) => {
  console.log("📲 Driver received ride request:", data);
});

// Connect as User
setTimeout(() => {
  const userSocket = io("http://localhost:8000/user", {
    auth: { userId: USER_ID },
  });

  userSocket.on("connect", () => {
    console.log("👤 User connected:", userSocket.id);

    // Send ride request with proper pickup/dropLocation structure
    const rideRequest = {
      driverId:DRIVER_ID,
      bookingId: BOOKING_ID,
      userId: USER_ID,
      pickupLocation,
      dropLocation,
      fare: 120,
    };

    userSocket.emit("ride:request", rideRequest, (res) => {
      console.log("📦 Ride request ACK:", res);
    });
  });

  userSocket.on("ride:accepted", (data) => {
    console.log("👍 User got ride accepted:", data);
  });

  userSocket.on("ride:started", (data) => {
    console.log("🏁 User sees ride started:", data);
  });

  userSocket.on("ride:completed", (data) => {
    console.log("✅ User sees ride completed:", data);
  });

  userSocket.on("ride:cancelled", (data) => {
    console.log("🚫 User sees ride cancelled:", data);
  });

  userSocket.on("driver:locationBroadcast", (data) => {
    console.log("📡 Driver location received by user:", data);
  });

  userSocket.on("connect_error", (err) => {
    console.error("❌ User socket connect error:", err.message);
  });

  userSocket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
}, 1000); // connect user 1 second after driver
