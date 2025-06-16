// const { Server } = require("socket.io");
// const logger = require("../utils/logger/logger");
// const socketAuth = require("./socketAuth");
// const { TypeOfUser } = require("../utils/constants/constants");
// const { handleDriverEvents } = require("./driverSocketHandler.new");
// const { handleUserEvents } = require("./userSocketHandler.new");
// const handleRideEvents = require("./rideSocketHandler.new");

// Import necessary modules
const { Server } = require("socket.io");
const logger = require("../utils/logger/logger"); // Custom logger utility
const socketAuth = require("./socketAuth"); // Middleware for authenticating socket connections
const { TypeOfUser } = require("../utils/constants/constants"); // Enum for user types
const { handleDriverEvents } = require("./driverSocketHandler.new"); // Driver-specific socket event handlers
const { handleUserEvents } = require("./userSocketHandler.new"); // User-specific socket event handlers
const handleRideEvents = require("./rideSocketHandler.new"); // Ride flow-related event handlers

/**
 * Initializes and configures the Socket.IO server
 * @param {Object} server - The HTTP server instance created using Express
 */
const handleSocketConnection = (server) => {
  // Object to keep track of drivers currently on-duty (available to take rides)
  const onDutyCaptains = {};

  // Initialize a new Socket.IO server instance with CORS configuration
  const io = new Server(server, {
    cors: {
      origin: "*", // Allow all origins (change this in production)
      methods: ["GET", "POST"], // Allowed HTTP methods
    },
  });

  // Attach authentication middleware to Socket.IO
  io.use(socketAuth);

  // Event: When a client successfully connects via WebSocket
  io.on("connection", (socket) => {
    const user = socket.user; // The authenticated user object from the middleware

    // Validate user object
    if (!user || !user.id) {
      logger.error("Socket connected without valid user data");
      socket.disconnect(); // Disconnect the socket if user data is invalid
      return;
    }

    logger.info(`User ${user.id} connected with role ${user.role}`);
    console.log(user); // Useful for debugging

    // Route socket events based on the type of user
    if (user.role === TypeOfUser.USER) {
      // Handle events related to regular users (like booking rides)
      handleUserEvents(socket, io, onDutyCaptains);
      // Handle shared ride logic (like request, cancel, complete)
      handleRideEvents(socket, io, onDutyCaptains);
    } else if (user.role === TypeOfUser.DRIVER) {
      // Handle events related to drivers (like going on-duty, accepting rides)
      handleDriverEvents(socket, io, onDutyCaptains);
    } else {
      // Unknown or unsupported user role
      logger.warn(`Unsupported user role connected: ${user.role}`);
    }

    // Event: When a socket disconnects (user leaves, closes app, loses connection)
    socket.on("disconnect", () => {
      logger.info(`User ${user.id} disconnected`);

      // If a driver disconnects, remove them from on-duty drivers list
      if (user.role === TypeOfUser.DRIVER && onDutyCaptains[user.id]) {
        delete onDutyCaptains[user.id];
        logger.info(`Driver ${user.id} removed from on-duty list`);
      }
    });

    // Event: General error handler for socket communication
    socket.on("error", (error) => {
      logger.error(`Socket error for user ${user.id}: ${error.message}`);
    });
  });

  // Store a reference to `io` globally so other parts of the app can emit events
  global.io = io;

  logger.info("Socket.IO server initialized successfully");

  // Return the server instance and shared state
  return { io, onDutyCaptains };
};

// Export the function so it can be used in the main server file
module.exports = { handleSocketConnection };


// /**
//  * Initialize and configure socket.io server
//  * @param {Object} server - HTTP server instance
//  */
// const handleSocketConnection = (server) => {
//   // Global state
//   const onDutyCaptains = {};
  
//   // Initialize Socket.IO with CORS
//   const io = new Server(server, {
//     cors: {
//       origin: "*", // In production, replace with specific origin
//       methods: ["GET", "POST"],
//     },
//   });

//   // Authentication middleware
//   io.use(socketAuth);

//   // Connection handler
//   io.on("connection", (socket) => {
//     const user = socket.user;
    
//     if (!user || !user.id) {
//       logger.error("Socket connected without user data");
//       socket.disconnect();
//       return;
//     }
    
//     logger.info(`User ${user.id} connected with role ${user.role}`);
//  console.log(user)
//     // Handle events based on user role
//     if (user.role === TypeOfUser.USER) {
//       handleUserEvents(socket, io, onDutyCaptains);
//       handleRideEvents(socket, io, onDutyCaptains);
//     } else if (user.role === TypeOfUser.DRIVER) {
//       handleDriverEvents(socket, io, onDutyCaptains);
//     } else {
//       logger.warn(`Unsupported user role connected: ${user.role}`);
//     }

//     // Common disconnect handler
//     socket.on("disconnect", () => {
//       logger.info(`User ${user.id} disconnected`);
      
//       // Clean up when driver disconnects
//       if (user.role === TypeOfUser.DRIVER && onDutyCaptains[user.id]) {
//         delete onDutyCaptains[user.id];
//         logger.info(`Driver ${user.id} removed from on-duty list`);
//       }
//     });
    
//     // Error handling
//     socket.on("error", (error) => {
//       logger.error(`Socket error for user ${user.id}: ${error.message}`);
//     });
//   });
  
//   // Keep reference to io for use in other modules
//   global.io = io;
  
//   logger.info("Socket.IO server initialized successfully");
  
//   return { io, onDutyCaptains };
// };

// module.exports = { handleSocketConnection };