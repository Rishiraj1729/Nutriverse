(() => {
  const KEY = "nv_cart";
  const WHATSAPP = "918452914697";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function readCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    render();
  }

  function add(id, qty = 1) {
    if (!window.NV || !NV.getProduct(id)) return;
    const items = readCart();
    const existing = items.find((i) => i.id === id);
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else items.push({ id, qty });
    writeCart(items);
    openCart();
  }

  function setQty(id, qty) {
    const next = Math.max(0, Math.min(99, Number(qty) || 0));
    let items = readCart();
    if (next < 1) items = items.filter((i) => i.id !== id);
    else {
      const row = items.find((i) => i.id === id);
      if (row) row.qty = next;
    }
    writeCart(items);
  }

  function count() {
    return readCart().reduce((n, i) => n + (Number(i.qty) || 0), 0);
  }

  function injectDrawer() {
    if ($("#cart-drawer")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="cart-overlay" data-close-cart hidden></div>
      <aside id="cart-drawer" class="cart-drawer" aria-hidden="true" aria-label="Cart">
        <div class="cart-head">
          <h2>Your crunch</h2>
          <button type="button" class="cart-close" data-close-cart aria-label="Close cart">×</button>
        </div>
        <div class="cart-body" id="cart-body"></div>
        <div class="cart-foot" id="cart-foot"></div>
      </aside>
    `;
    document.body.append(...wrap.childNodes);
  }

  function ensureCartButton() {
    if ($("[data-open-cart]")) return;
    const inner = $(".header-inner");
    if (!inner) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cart-btn";
    btn.setAttribute("data-open-cart", "");
    btn.setAttribute("aria-label", "Open cart");
    btn.innerHTML = `Cart <span class="cart-count">0</span>`;
    const toggle = $(".menu-toggle");
    if (toggle) inner.insertBefore(btn, toggle);
    else inner.appendChild(btn);
  }

  function openCart() {
    const drawer = $("#cart-drawer");
    const overlay = $(".cart-overlay");
    if (!drawer) return;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    if (overlay) overlay.hidden = false;
  }

  function closeCart() {
    const drawer = $("#cart-drawer");
    const overlay = $(".cart-overlay");
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    if (overlay) overlay.hidden = true;
  }

  function render() {
    if (!window.NV) return;
    const items = readCart();
    const totals = NV.totalsFromItems(items);
    $$(".cart-count").forEach((el) => {
      el.textContent = String(count());
      el.hidden = count() === 0;
    });

    const body = $("#cart-body");
    const foot = $("#cart-foot");
    if (!body || !foot) return;

    if (!totals.lines.length) {
      body.innerHTML = `<p class="cart-empty">Cart’s empty. The makhana is not.</p>`;
      foot.innerHTML = `<a class="btn btn-dark" href="products.html">Shop the lineup</a>`;
      return;
    }

    body.innerHTML = totals.lines.map((line) => `
      <div class="cart-line">
        <img src="${line.image}" alt="">
        <div>
          <strong>${line.name}</strong>
          <p>${NV.rupees(line.price)}</p>
          <div class="qty">
            <button type="button" data-qty="${line.id}" data-d="-1" aria-label="Less">−</button>
            <span>${line.qty}</span>
            <button type="button" data-qty="${line.id}" data-d="1" aria-label="More">+</button>
          </div>
        </div>
        <button type="button" class="cart-remove" data-remove="${line.id}" aria-label="Remove">Remove</button>
      </div>
    `).join("");

    const shipNote = totals.shipping === 0
      ? "Free shipping"
      : `${NV.rupees(totals.shipping)} shipping · free over ${NV.rupees(totals.freeShippingAt)}`;

    foot.innerHTML = `
      <div class="cart-totals">
        <span>Subtotal</span><strong>${NV.rupees(totals.subtotal)}</strong>
        <span>Shipping</span><strong>${shipNote}</strong>
        <span>Total</span><strong>${NV.rupees(totals.total)}</strong>
      </div>
      <a class="btn btn-dark" href="checkout.html">Checkout</a>
    `;
  }

  function bind() {
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        e.preventDefault();
        add(addBtn.getAttribute("data-add"), 1);
        return;
      }
      if (e.target.closest("[data-open-cart]")) {
        e.preventDefault();
        openCart();
        return;
      }
      if (e.target.closest("[data-close-cart]")) {
        closeCart();
        return;
      }
      const qtyBtn = e.target.closest("[data-qty]");
      if (qtyBtn) {
        const id = qtyBtn.getAttribute("data-qty");
        const d = Number(qtyBtn.getAttribute("data-d"));
        const row = readCart().find((i) => i.id === id);
        setQty(id, (row ? row.qty : 0) + d);
        return;
      }
      const rm = e.target.closest("[data-remove]");
      if (rm) setQty(rm.getAttribute("data-remove"), 0);
    });
  }

  window.NVCart = { add, readCart, count, openCart, closeCart, WHATSAPP };

  injectDrawer();
  ensureCartButton();
  bind();
  render();
})();
