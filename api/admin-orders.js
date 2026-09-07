const { json, readBody } = require("../lib/orders");
const { bearer, listAllOrders, updateOrderStatus } = require("../lib/db");

module.exports = async (req, res) => {
  const token = bearer(req);
  if (req.method === "GET") {
    const result = await listAllOrders(token);
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  if (req.method === "PATCH") {
    const body = await readBody(req);
    const result = await updateOrderStatus(token, String(body.id || ""), String(body.status || ""));
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  return json(res, 405, { error: "Method not allowed" });
};
