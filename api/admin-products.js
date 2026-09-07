const { json, readBody } = require("../lib/orders");
const { bearer, listAdminProducts, saveAdminProduct, deleteAdminProduct, saveStoreSettings } = require("../lib/db");

module.exports = async (req, res) => {
  const token = bearer(req);
  if (req.method === "GET") {
    const result = await listAdminProducts(token);
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  if (req.method === "POST" || req.method === "PATCH") {
    const body = await readBody(req);
    if (body && body.settings) {
      const result = await saveStoreSettings(token, body.settings);
      if (result.error) return json(res, result.status || 400, { error: result.error });
      return json(res, 200, result);
    }
    const result = await saveAdminProduct(token, body || {}, req.method === "POST");
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  if (req.method === "DELETE") {
    const body = await readBody(req).catch(() => ({}));
    const id = String((body && body.id) || "").trim();
    const result = await deleteAdminProduct(token, id);
    if (result.error) return json(res, result.status || 400, { error: result.error });
    return json(res, 200, result);
  }
  return json(res, 405, { error: "Method not allowed" });
};
