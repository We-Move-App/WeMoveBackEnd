const ApiError = require("../utils/response/ApiError");

let ioInstance;
const onDutyCaptains = {};

const handleSocketConnection = (server) => {
  const { Server } = require("socket.io");
  const socketAuth = require("./socketAuth");
  const { TypeOfUser } = require("../utils/constants/constants");
  const { handleDriverEvents } = require("./driverSocketHandler");
  const { handleUserEvents } = require("./userSocketHandler");

  ioInstance = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  ioInstance.use(socketAuth);

  ioInstance.on("connection", (socket) => {
    console.log(`User ${socket.user?.id} connected`);
    const user = socket.user;
    console.log(user)

    if (user?.role === TypeOfUser.USER) {
      handleUserEvents(socket, ioInstance, onDutyCaptains);
    } else if (user?.role === TypeOfUser.DRIVER) {
      handleDriverEvents(socket, ioInstance, onDutyCaptains);
    }

    socket.on("disconnect", () => {
      if (user.role === TypeOfUser.USER) {
        delete onDutyCaptains[user.id];
      } else if (user.role === TypeOfUser.DRIVER) {
        console.log(`Customer ${user.id} disconnected.`);
      }
    });
  });
};

const getIo = () => {
  if (!ioInstance) throw new ApiError(500,"Socket.io not initialized");
  return ioInstance;
};

module.exports = {
  handleSocketConnection,
  getIo, 
  onDutyCaptains,
};
