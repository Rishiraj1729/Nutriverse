const { json } = require("../lib/orders");
const { checkCoupon, normalizeCode } = require("../lib/catalog");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const url = new URL(req.url, "http://localhost");
  const code = normalizeCode(url.searchParams.get("code"));
  const phone = String(url.searchParams.get("phone") || "").replace(/\D/g, "");
  if (!code) return json(res, 400, { error: "Enter a coupon code." });
  const result = await checkCoupon(code, phone);
  if (result.error) return json(res, 400, { error: result.error });
  json(res, 200, { coupon: result.coupon });
};
