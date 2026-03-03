const UserModel = require("../../models/user-module/users/user.model");

const fetchLn = async (userId) => {
  try {
    if (!userId) return "en";

    const user = await UserModel.findById(userId).select("ln");

    return user?.ln || "en";
  } catch (err) {
    return "en";
  }
};

module.exports = { fetchLn };
