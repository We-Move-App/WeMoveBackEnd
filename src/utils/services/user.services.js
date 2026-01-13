const UserModel = require("../../models/user-module/users/user.model");

const fetchLn = async (userId) => {
  const user = await UserModel.findById(userId);

  const ln = user.ln ? user.ln : "en";

  return ln;
};

module.exports = { fetchLn };
