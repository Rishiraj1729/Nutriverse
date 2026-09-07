const { json } = require("../lib/orders");
const { loadPublicCatalog } = require("../lib/catalog");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const catalog = await loadPublicCatalog();
  json(res, 200, {
    products: catalog.PRODUCTS,
    shipping: {
      flat: catalog.SHIPPING.flat,
      freeAbove: catalog.SHIPPING.freeAbove
    }
  });
};
