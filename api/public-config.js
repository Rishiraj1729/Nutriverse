const { json } = require("../lib/orders");
const { supabaseConfig, ADMIN_EMAIL } = require("../lib/db");

module.exports = async (req, res) => {
  const cfg = supabaseConfig();
  json(res, 200, {
    supabaseUrl: cfg.url,
    supabaseAnonKey: cfg.anonKey,
    authEnabled: Boolean(cfg.url && cfg.anonKey),
    adminEmail: ADMIN_EMAIL,
    razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  });
};
