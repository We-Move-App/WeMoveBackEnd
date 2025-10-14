const express = require('express');

const {

    getAvatar,
    changePassword,
    setPassword,
    resetPassword,
    updateAvatar,
    resetPassword2,
    getAvailableModules,

} = require("../../../controllers/user-module/users/users.controllers");

const { addMemberUnderUser,
    getAllMembersUnderUser,
    getUserProfile,
    deleteMemberByUserId,
    getTransactions
} = require("../../../controllers/user-module/userMember/userMember.Controllers");

const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
    uploadDocuments,
    uploadAvatar,
} = require("../../../utils/uploadFiles/multer");

const userMemberRoutes = express.Router();

// Route to add a member under a user

userMemberRoutes.route("/add-member").post(isUserAuthenticated, addMemberUnderUser);
userMemberRoutes.route("/get-members").get(isUserAuthenticated, getAllMembersUnderUser);
userMemberRoutes.route("/delete-member/:userId").delete(isUserAuthenticated, deleteMemberByUserId);
userMemberRoutes.route("/getProfile").get(isUserAuthenticated, getUserProfile)
userMemberRoutes
    .route("/update-avartar")
    .put(isUserAuthenticated, uploadDocuments, updateAvatar);
userMemberRoutes.route("/getAvatar").get(isUserAuthenticated, getAvatar);
userMemberRoutes.route("/viewTransaction").get(isUserAuthenticated, getTransactions);


module.exports = userMemberRoutes;  