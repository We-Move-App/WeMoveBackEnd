const jwt = require("jsonwebtoken");

const setupAdminNamespace = (adminNamespace, io) => {
  adminNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      if (!["SuperAdmin", "Admin", "SubAdmin"].includes(decoded.role)) {
        return next(new Error("Unauthorized"));
      }

      socket.data.adminId = decoded._id;
      socket.data.role = decoded.role;

      // Join rooms
      socket.join(socket.data.adminId.toString());
      socket.join(socket.data.role);

      next();
    } catch (err) {
      return next(new Error("Authentication failed"));
    }
  });
};

module.exports = { setupAdminNamespace };
