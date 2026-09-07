const { json } = require("../lib/orders");
const { bearer, listMyOrders } = require("../lib/db");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const result = await listMyOrders(bearer(req));
  if (result.error) return json(res, result.status || 400, { error: result.error });
  json(res, 200, result);
};
