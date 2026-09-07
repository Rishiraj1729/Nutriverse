/* Fallback catalog if the live API is down.
   Live prices and SKUs come from /api/catalog (admin dashboard). */
(function (root) {
  const DEFAULT_PRODUCTS = [
    {
      id: "mix-masala",
      name: "Mix Masala",
      category: "makhana",
      price: 149,
      unit: "pack",
      image: "assets/mixmasala.png",
      blurb: "Bold desi punch. Handpicked Bihar makhana."
    },
    {
      id: "cream-onion",
      name: "Cream & Onion",
      category: "makhana",
      price: 149,
      unit: "pack",
      image: "assets/creamonion.webp",
      blurb: "Smooth, savoury, everyday addictive."
    },
    {
      id: "cheesy-twistah",
      name: "Cheesy Twistah",
      category: "makhana",
      price: 149,
      unit: "pack",
      image: "assets/product.png",
      blurb: "Cheese flavour without the fryer."
    },
    {
      id: "peri-punch",
      name: "Peri Punch",
      category: "makhana",
      price: 149,
      unit: "pack",
      image: "assets/product.png",
      blurb: "Spicy kick for snack breaks that hit different."
    },
    {
      id: "himalayan-salt",
      name: "Himalayan Salt",
      category: "makhana",
      price: 149,
      unit: "pack",
      image: "assets/product.png",
      blurb: "Clean, minimal, ancient superfood simply done."
    },
    {
      id: "mint-o-magic",
      name: "Mint O Magic",
      category: "makhana",
      price: 149,
      unit: "pack",
      image: "assets/mixmasala.png",
      blurb: "Fresh crunch energy. Unexpected favourite."
    },
    {
      id: "millet-cookies",
      name: "Makhana Millet Cookies",
      category: "cookies",
      price: 99,
      unit: "50g",
      image: "assets/cookies.png",
      blurb: "No maida. No palm oil. No refined sugar. Made in butter."
    },
    {
      id: "raw-makhana",
      name: "Raw Makhana 200g",
      category: "raw",
      price: 199,
      unit: "200g",
      image: "assets/product.png",
      blurb: "Premium fox nuts. Retail packs."
    },
    {
      id: "maknova-masala",
      name: "Maknova Masala Masti",
      category: "maknova",
      price: 10,
      unit: "pack",
      image: "assets/maknova_logo_bgR.png",
      blurb: "Bold masala. ₹10. Roasted, never fried."
    },
    {
      id: "maknova-cheese",
      name: "Maknova Cheese",
      category: "maknova",
      price: 10,
      unit: "pack",
      image: "assets/maknova_logo_bgR.png",
      blurb: "Creamy cheese crunch at ₹10."
    },
    {
      id: "maknova-tomato",
      name: "Maknova Tangy Tomato",
      category: "maknova",
      price: 10,
      unit: "pack",
      image: "assets/maknova_logo_bgR.png",
      blurb: "Sharp, zesty, addictive. ₹10."
    }
  ];

  const DEFAULT_SHIPPING = {
    flat: 49,
    freeAbove: 499,
    country: "IN"
  };

  function makeCatalog(productList, shippingOpts) {
    const PRODUCTS = (productList || DEFAULT_PRODUCTS).map((p) => Object.assign({}, p));
    const SHIPPING = Object.assign({}, DEFAULT_SHIPPING, shippingOpts || {});

    function getProduct(id) {
      return PRODUCTS.find((p) => p.id === id) || null;
    }

    function shippingFor(subtotal) {
      if (subtotal <= 0) return 0;
      return subtotal >= SHIPPING.freeAbove ? 0 : SHIPPING.flat;
    }

    function totalsFromItems(items) {
      const lines = [];
      let subtotal = 0;
      for (const item of items) {
        const product = getProduct(item.id);
        const qty = Math.max(0, Math.min(99, Number(item.qty) || 0));
        if (!product || qty < 1) continue;
        const lineTotal = product.price * qty;
        subtotal += lineTotal;
        lines.push({
          id: product.id,
          name: product.name,
          qty,
          price: product.price,
          lineTotal,
          image: product.image
        });
      }
      const shipping = shippingFor(subtotal);
      return {
        lines,
        subtotal,
        shipping,
        total: subtotal + shipping,
        freeShippingAt: SHIPPING.freeAbove
      };
    }

    function rupees(n) {
      return "₹" + Number(n).toLocaleString("en-IN");
    }

    return { PRODUCTS, SHIPPING, getProduct, shippingFor, totalsFromItems, rupees };
  }

  const catalog = makeCatalog(DEFAULT_PRODUCTS, DEFAULT_SHIPPING);

  function applyLive(live) {
    if (!live || !Array.isArray(live.products) || !live.products.length) return false;
    catalog.PRODUCTS.splice(0, catalog.PRODUCTS.length, ...live.products.map((p) => Object.assign({}, p)));
    if (live.shipping) {
      if (live.shipping.flat != null) catalog.SHIPPING.flat = Number(live.shipping.flat);
      if (live.shipping.freeAbove != null) catalog.SHIPPING.freeAbove = Number(live.shipping.freeAbove);
    }
    return true;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function cardHtml(p, kind) {
    const cls = kind === "hit" ? "hit-card" : "product-card";
    const extra = p.category === "maknova" ? " cat-maknova" : " cat-" + p.category;
    const tag = p.category === "maknova"
      ? catalog.rupees(p.price) + " · No palm oil"
      : (p.category === "makhana" ? "Olive roasted" : (p.unit || p.category));
    return `<article class="${cls}${extra}" data-cat="${escapeHtml(p.category)}" data-sku="${escapeHtml(p.id)}">
      <span class="tag">${escapeHtml(tag)}</span>
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.blurb)}</p>
      <div class="price-row"><span class="price">${catalog.rupees(p.price)}</span></div>
      <button type="button" class="btn btn-dark" data-add="${escapeHtml(p.id)}">Add to cart</button>
    </article>`;
  }

  function hydrateStorefront() {
    document.querySelectorAll("[data-add]").forEach((btn) => {
      const id = btn.getAttribute("data-add");
      const p = catalog.getProduct(id);
      const card = btn.closest(".product-card, .hit-card, article");
      if (!p) {
        if (card) card.hidden = true;
        return;
      }
      if (card) card.hidden = false;
      const priceEl = card && card.querySelector(".price");
      if (priceEl) priceEl.textContent = catalog.rupees(p.price);
    });

    const grid = document.querySelector(".product-grid");
    const hits = document.getElementById("hits-track");
    catalog.PRODUCTS.forEach((p) => {
      const existing = document.querySelector('[data-add="' + p.id.replace(/"/g, "") + '"]');
      if (existing) return;
      if (grid) grid.insertAdjacentHTML("beforeend", cardHtml(p, "product"));
      if (hits) hits.insertAdjacentHTML("beforeend", cardHtml(p, "hit"));
    });
  }

  catalog.applyLive = applyLive;
  catalog.makeCatalog = makeCatalog;
  catalog.hydrateStorefront = hydrateStorefront;
  catalog.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = catalog;
  } else {
    root.NV = catalog;
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((live) => {
        if (applyLive(live)) hydrateStorefront();
        document.dispatchEvent(new CustomEvent("nv-catalog"));
      })
      .catch(() => {});
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
