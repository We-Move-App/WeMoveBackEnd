const { AdminModel } = require("../../models/admin-module/admin/admin.model");
const config = require("../../config/config");

const {
  createSuperAdmin,
} = require("../../controllers/admin-module/admin-auth/admin-auth.controllers");
const generateCustomId = require("../customId/generateCustomId");
const { EntityCodeEnum } = require("../constants/ENUM");

async function initSuperAdmin() {
  const existing = await AdminModel.findOne({ role: "SuperAdmin" });
  if (existing) {
    console.log(" SuperAdmin already exists:", existing.email);
    return;
  }

  console.log(" Creating SuperAdmin...");

  const adminId = await generateCustomId(EntityCodeEnum.ADMIN, "A");
  const req = {
    body: {
      adminId,
      email: config.superadmin_email,
      userName: config.superadmin_username,
      password: config.superadmin_password,
      phoneNumber: config.superadmin_phone,
    },
  };

  // res only needs status + json since that’s all your controller calls
  const res = {
    status: (code) => ({
      json: (data) => {
        console.log(" SuperAdmin created:", data.user?.email || req.body.email);
        return data;
      },
    }),
    cookie: () => {}, // if your controller sets cookies, stub it
  };

  const next = (err) => {
    if (err) console.error("SuperAdmin creation failed:", err.message);
  };

  await createSuperAdmin(req, res, next);
}

module.exports = { initSuperAdmin };
