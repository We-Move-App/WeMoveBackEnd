const { rideHandler } = require("../handlers/rideHandler");
const jwt = require('jsonwebtoken');

const setupUserNamespace = (userNamespace, io) => {
  userNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log(token);
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      if (decoded.role !== 'user') {
        return next(new Error('Unauthorized'));
      }
      
      // Use _id if userId not present
      socket.data.userId = decoded._id;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  userNamespace.on("connection", (socket) => {
    console.log("socket.data.userId",socket.data.userId);
    
    const { userId } = socket.data.userId;   
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.log("👤 User connected:", userId);

    // put the socket in a room so we can target messages to this user
    socket.join(userId);

    rideHandler(socket, io, "user");

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", userId);
    });
  });
};

module.exports = { setupUserNamespace };
