const { json, readBody } = require("../lib/orders");
const { bearer, listAdminCoupons, saveAdminCoupon, patchAdminCoupon, deleteAdminCoupon } = require("../lib/db");

module.exports = async (req, res) => {
  const token = bearer(req);
  if (req.method === "GET") {
    const result = await listAdminCoupons(token);
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  if (req.method === "POST") {
    const body = await readBody(req);
    const result = await saveAdminCoupon(token, body || {});
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  if (req.method === "PATCH") {
    const body = await readBody(req);
    const result = await patchAdminCoupon(token, body || {});
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  if (req.method === "DELETE") {
    const body = await readBody(req).catch(() => ({}));
    const result = await deleteAdminCoupon(token, body && body.code);
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  return json(res, 405, { error: "Method not allowed" });
};
