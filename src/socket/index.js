const { setupDriverNamespace } = require("./namespaces/driver");
const { setupUserNamespace } = require("./namespaces/user");

const initializeSocket = (io) => {
  const driverNamespace = io.of("/driver");
  const userNamespace = io.of("/user");

  setupDriverNamespace(driverNamespace, io);
  setupUserNamespace(userNamespace, io);
};

module.exports = initializeSocket;