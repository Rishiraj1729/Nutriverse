(() => {
  const statuses = ["pending", "paid", "packed", "shipped", "delivered", "cancelled"];
  const err = document.getElementById("admin-error");
  const ok = document.getElementById("admin-ok");
  let headers = {};
  let products = [];

  function note(errorText, okText) {
    err.textContent = errorText || "";
    ok.textContent = okText || "";
  }

  function rupees(n) {
    return window.NV ? NV.rupees(n) : "₹" + n;
  }

  function showTab(id) {
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === id);
    });
    document.getElementById("tab-skus").hidden = id !== "skus";
    document.getElementById("tab-orders").hidden = id !== "orders";
  }

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.getAttribute("data-tab")));
  });

  function rowFromForm(form) {
    const data = new FormData(form);
    return {
      id: String(data.get("id") || "").trim(),
      name: String(data.get("name") || "").trim(),
      price: Number(data.get("price")),
      category: String(data.get("category") || "makhana"),
      unit: String(data.get("unit") || "pack").trim(),
      image: String(data.get("image") || "").trim(),
      blurb: String(data.get("blurb") || "").trim(),
      active: true
    };
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

  function renderSkus() {
    const tb = document.querySelector("#sku-table tbody");
    tb.innerHTML = products.map((p) => `
      <tr data-sku="${escapeHtml(p.id)}">
        <td>
          <div class="sku-cell">
            <img src="${escapeHtml(p.image)}" alt="">
            <div>
              <strong>${escapeHtml(p.name)}</strong><br>
              <small>${escapeHtml(p.id)} · ${escapeHtml(p.unit || "pack")}</small>
            </div>
          </div>
        </td>
        <td>${escapeHtml(p.category)}</td>
        <td><input class="sku-price" type="number" min="1" step="1" value="${Number(p.price)}" aria-label="Price for ${escapeHtml(p.name)}"></td>
        <td><label class="sku-toggle"><input type="checkbox" class="sku-active" ${p.active ? "checked" : ""}> Live</label></td>
        <td>
          <button type="button" class="btn btn-outline sku-save">Save</button>
          <button type="button" class="sku-delete">Remove</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="5">No SKUs yet.</td></tr>`;
  }

  async function loadSkus() {
    const res = await fetch("/api/admin-products", { headers });
    const data = await res.json();
    if (!res.ok) {
      note(data.error || "Could not load SKUs.");
      return;
    }
    products = data.products || [];
    const s = data.settings || {};
    document.getElementById("ship-flat").value = s.shipping_flat ?? 49;
    document.getElementById("ship-free").value = s.free_above ?? 499;
    renderSkus();
  }

  async function loadOrders() {
    const res = await fetch("/api/admin-orders", { headers });
    const data = await res.json();
    if (!res.ok) {
      note(data.error || "Could not load orders.");
      return;
    }
    const tb = document.querySelector("#admin-table tbody");
    tb.innerHTML = (data.orders || []).map((o) => {
      const c = o.customer || {};
      const opts = statuses.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("");
      const lines = (o.items || []).map((i) => `${escapeHtml(i.name)} × ${escapeHtml(i.qty)}`).join(", ");
      return `<tr>
        <td><strong>${escapeHtml(o.id)}</strong><br><small>${lines}</small></td>
        <td>${new Date(o.created_at).toLocaleString("en-IN")}</td>
        <td>${escapeHtml(c.name)}<br><small>${escapeHtml(c.phone)} · ${escapeHtml(c.email)}<br>${escapeHtml(c.address)}<br>${escapeHtml(c.city)} ${escapeHtml(c.pincode)}</small></td>
        <td>${escapeHtml(o.payment)}</td>
        <td>${rupees(o.total)}</td>
        <td><select data-id="${escapeHtml(o.id)}">${opts}</select></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6">No orders yet.</td></tr>`;
  }

  async function saveSku(body, isInsert) {
    const res = await fetch("/api/admin-products", {
      method: isInsert ? "POST" : "PATCH",
      headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      note(data.error || "Could not save.");
      return false;
    }
    note("", isInsert ? "SKU added. It is live on the store." : "Saved.");
    await loadSkus();
    return true;
  }

  (async function () {
    if (!(await NVAuth.isAdmin())) {
      const u = await NVAuth.user();
      if (!u) location.href = "login.html?next=admin.html";
      else note("This dashboard is only for Admin_Nutriverse.");
      return;
    }
    const token = await NVAuth.accessToken();
    headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    await Promise.all([loadSkus(), loadOrders()]);

    document.getElementById("sku-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const okSave = await saveSku(rowFromForm(e.target), true);
      if (okSave) e.target.reset();
    });

    document.getElementById("shipping-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const res = await fetch("/api/admin-products", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          settings: {
            shipping_flat: Number(data.get("shipping_flat")),
            free_above: Number(data.get("free_above"))
          }
        })
      });
      const body = await res.json();
      if (!res.ok) note(body.error || "Could not save shipping.");
      else note("", "Shipping updated.");
    });

    document.querySelector("#sku-table").addEventListener("click", async (e) => {
      const tr = e.target.closest("tr[data-sku]");
      if (!tr) return;
      const id = tr.getAttribute("data-sku");
      const current = products.find((p) => p.id === id);
      if (!current) return;

      if (e.target.closest(".sku-save")) {
        const price = Number(tr.querySelector(".sku-price").value);
        const active = tr.querySelector(".sku-active").checked;
        await saveSku({ ...current, price, active }, false);
        return;
      }
      if (e.target.closest(".sku-delete")) {
        if (!confirm("Remove " + current.name + " from the catalog?")) return;
        const res = await fetch("/api/admin-products", {
          method: "DELETE",
          headers,
          body: JSON.stringify({ id })
        });
        const body = await res.json();
        if (!res.ok) note(body.error || "Could not delete.");
        else {
          note("", "SKU removed.");
          await loadSkus();
        }
      }
    });

    document.querySelector("#admin-table tbody").addEventListener("change", async (e) => {
      const sel = e.target.closest("select[data-id]");
      if (!sel) return;
      const patch = await fetch("/api/admin-orders", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: sel.getAttribute("data-id"), status: sel.value })
      });
      const body = await patch.json();
      if (!patch.ok) note(body.error || "Update failed.");
      else note("", "Order status updated.");
    });
  })();
})();
