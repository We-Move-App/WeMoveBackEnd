const{ AdminModel} = require("../../models/admin-module/admin/admin.model")
const config = require("../../config/config")

const { createSuperAdmin}  = require("../../controllers/admin-module/admin-auth/admin-auth.controllers");




async function initSuperAdmin() {
  const existing = await AdminModel.findOne({ role: "SuperAdmin" });
  if (existing) {
    console.log(" SuperAdmin already exists:", existing.email);
    return;
  }

  console.log(" Creating SuperAdmin...");

  // Construct a real req/res/next (minimal mock, but real execution of your controller)
  const req = {
    body: {
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

  await  createSuperAdmin (req, res, next);
}

module.exports = { initSuperAdmin };
