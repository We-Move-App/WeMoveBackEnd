// const { io } = require("socket.io-client");

// // Configuration
// const CONFIG = {
//   SERVER_URL: "http://localhost:8000",
//   DRIVER_ID: "WED130610",
//   USER_ID: "USER_456",
//   VEHICLE_TYPE: "bike",
//   TEST_RIDE: {
//     pickupLocation: {
//       lat: 12.9716,
//       lng: 77.5946,
//       address: "MG Road, Bengaluru"
//     },
//     dropLocation: {
//       lat: 12.9352,
//       lng: 77.6146,
//       address: "Koramangala, Bengaluru"
//     },
//     fare: 120
//   }
// };

// // Global variables
// let bookingId = null;
// let otp = null;

// // Helper function for console logging with timestamps
// const log = (role, message) => {
//   console.log(`[${new Date().toISOString()}] [${role}] ${message}`);
// };

// // ====================== DRIVER CLIENT ======================
// const driverSocket = io(`${CONFIG.SERVER_URL}/driver`, {
//   auth: { driverId: CONFIG.DRIVER_ID }
// });

// // Driver event handlers
// driverSocket.on("connect", () => {
//   log("DRIVER", `Connected with socket ID: ${driverSocket.id}`);

//   // Update driver location to pickup point
//   driverSocket.emit("driver:locationUpdate", {
//     driverId: CONFIG.DRIVER_ID,
//     coords: CONFIG.TEST_RIDE.pickupLocation
//   });
// });

// driverSocket.on("ride:incoming", (data) => {
//   log("DRIVER", `Received ride request: ${JSON.stringify(data)}`);
//   bookingId = data.bookingId;
//   otp = data.otp;

//   // Auto-accept after 2 seconds (simulate driver thinking time)
//   setTimeout(() => {
//     log("DRIVER", "Accepting ride...");
//     driverSocket.emit("ride:accept", { bookingId }, (response) => {
//       if (response?.success) {
//         log("DRIVER", "Ride accepted successfully");
        
//         // Simulate driver arriving after 5 seconds
//         setTimeout(() => {
//           log("DRIVER", "Marking as arrived...");
//           driverSocket.emit("ride:arrived", { bookingId }, (response) => {
//             if (response?.success) {
//               log("DRIVER", "Arrival confirmed");
              
//               // Simulate OTP verification after 3 seconds
//               setTimeout(() => {
//                 log("DRIVER", `Verifying OTP: ${otp}`);
//                 driverSocket.emit("ride:verifyOtp", { bookingId, otp }, (response) => {
//                   if (response?.success) {
//                     log("DRIVER", "OTP verified successfully");
                    
//                     // Start ride after 2 seconds
//                     setTimeout(() => {
//                       log("DRIVER", "Starting ride...");
//                       driverSocket.emit("ride:start", { bookingId }, (response) => {
//                         if (response?.success) {
//                           log("DRIVER", "Ride started");
                          
//                           // Complete ride after 5 seconds
//                           setTimeout(() => {
//                             log("DRIVER", "Completing ride...");
//                             driverSocket.emit("ride:complete", { bookingId }, (response) => {
//                               if (response?.success) {
//                                 log("DRIVER", "Ride completed successfully");
//                               }
//                             });
//                           }, 5000);
//                         }
//                       });
//                     }, 2000);
//                   }
//                 });
//               }, 3000);
//             }
//           });
//         }, 5000);
//       }
//     });
//   }, 2000);
// });

// // ====================== USER CLIENT ======================
// setTimeout(() => {
//   const userSocket = io(`${CONFIG.SERVER_URL}/user`, {
//     auth: { userId: CONFIG.USER_ID }
//   });

//   // User event handlers
//   userSocket.on("connect", () => {
//     log("USER", `Connected with socket ID: ${userSocket.id}`);

//     // Request a ride
//     log("USER", "Requesting a ride...");
//     userSocket.emit("ride:request", {
//       userId: CONFIG.USER_ID,
//       ...CONFIG.TEST_RIDE,
//       vehicleType: CONFIG.VEHICLE_TYPE
//     }, (response) => {
//       if (response?.success) {
//         log("USER", `Ride requested successfully. Booking ID: ${response.bookingId}`);
//         bookingId = response.bookingId;
//         otp = response.otp;
//         log("USER", `Your OTP is: ${otp}`);
//       }
//     });
//   });

//   userSocket.on("ride:accepted", (data) => {
//     log("USER", `Ride accepted by driver: ${data.driverId}`);
//     log("USER", `Please share this OTP with driver: ${data.otp}`);
//   });

//   userSocket.on("ride:arrived", (data) => {
//     log("USER", `Driver has arrived at pickup location for booking: ${data.bookingId}`);
//   });

//   userSocket.on("ride:otpVerified", (data) => {
//     if (data.success) {
//       log("USER", `OTP verified successfully for booking: ${data.bookingId}`);
//     } else {
//       log("USER", `OTP verification failed for booking: ${data.bookingId}`);
//     }
//   });

//   userSocket.on("ride:started", (data) => {
//     log("USER", `Ride started for booking: ${data.bookingId}`);
//   });

//   userSocket.on("ride:completed", (data) => {
//     log("USER", `Ride completed for booking: ${data.bookingId}`);
//   });

//   userSocket.on("ride:cancelled", (data) => {
//     log("USER", `Ride cancelled: ${data.reason}`);
//   });

// }, 1000); // Delay user connection to ensure driver is ready first