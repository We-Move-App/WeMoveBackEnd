const { rideHandler } = require("../handlers/rideHandler");

const setupUserNamespace = (userNamespace, io) => {
  userNamespace.on("connection", (socket) => {
    const { userId } = socket.handshake.auth || {};

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = userId;
    console.log("👤 User connected:", userId);

    rideHandler(socket, io, "user");

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", userId);
    });
  });
};

module.exports = { setupUserNamespace };
