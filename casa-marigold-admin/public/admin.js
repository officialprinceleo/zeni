const $ = id => document.getElementById(id);
let items = [];
let dirty = false;

async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

function showView(loggedIn) {
  $("loginView").hidden = loggedIn;
  $("editorView").hidden = !loggedIn;
  $("logout").hidden = !loggedIn;
  if (!loggedIn) $("password").focus();
}

function setMsg(node, text, kind = "") {
  node.textContent = text;
  node.className = "msg" + (kind ? " " + kind : "");
}

function markDirty() {
  dirty = true;
  setMsg($("saveMsg"), "Unsaved changes");
}

function blankDish() {
  const cat = items.length ? items[items.length - 1].cat : "Mains";
  return { name: "", cat, price: 0, emoji: "🍽️", tint: "#cfe59a", veg: false, desc: "" };
}

function renderCats() {
  const list = $("cats");
  list.replaceChildren();
  [...new Set(items.map(i => i.cat).filter(Boolean))].forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    list.appendChild(o);
  });
}

function renderRows() {
  const rows = $("rows");
  rows.replaceChildren();
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <input class="f-emoji" aria-label="Emoji" maxlength="16" required>
      <input class="f-name" aria-label="Dish name" placeholder="Dish name" maxlength="80" required>
      <input class="f-cat" aria-label="Category" placeholder="Category" list="cats" maxlength="40" required>
      <input class="f-price" aria-label="Price" type="number" min="0" max="10000" step="0.01" required>
      <input class="f-tint" aria-label="Background color" type="color">
      <textarea class="f-desc" aria-label="Description" placeholder="Description" rows="2" maxlength="300"></textarea>
      <div class="f-foot">
        <label class="f-veg"><input class="f-vegbox" type="checkbox"> Vegetarian</label>
        <div class="f-actions">
          <button type="button" data-a="up" aria-label="Move up">↑</button>
          <button type="button" data-a="down" aria-label="Move down">↓</button>
          <button type="button" data-a="del" class="del">Delete</button>
        </div>
      </div>`;

    const bind = (sel, key, read, write) => {
      const input = row.querySelector(sel);
      write(input, item[key]);
      input.addEventListener("input", () => {
        item[key] = read(input);
        markDirty();
        if (key === "cat") renderCats();
      });
    };
    const text = [i => i.value, (i, v) => { i.value = v; }];
    bind(".f-emoji", "emoji", ...text);
    bind(".f-name", "name", ...text);
    bind(".f-cat", "cat", ...text);
    bind(".f-desc", "desc", ...text);
    bind(".f-tint", "tint", ...text);
    bind(".f-price", "price", i => (i.value === "" ? "" : parseFloat(i.value)), (i, v) => { i.value = v; });
    bind(".f-vegbox", "veg", i => i.checked, (i, v) => { i.checked = v; });

    row.querySelector('[data-a="up"]').disabled = idx === 0;
    row.querySelector('[data-a="down"]').disabled = idx === items.length - 1;
    row.querySelector(".f-actions").addEventListener("click", e => {
      const a = e.target.dataset.a;
      if (!a) return;
      if (a === "del") {
        if (!confirm(`Delete "${item.name || "this dish"}"?`)) return;
        items.splice(idx, 1);
      } else {
        const to = a === "up" ? idx - 1 : idx + 1;
        [items[idx], items[to]] = [items[to], items[idx]];
      }
      markDirty();
      renderRows();
      renderCats();
    });
    rows.appendChild(row);
  });
}

async function loadEditor() {
  items = await api("/api/menu");
  dirty = false;
  renderRows();
  renderCats();
  setMsg($("saveMsg"), "");
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  setMsg($("loginMsg"), "");
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("password").value }) });
    $("password").value = "";
    await loadEditor();
    showView(true);
  } catch (err) {
    setMsg($("loginMsg"), err.message, "error");
  }
});

$("logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  dirty = false;
  showView(false);
});

$("addBtn").addEventListener("click", () => {
  items.push(blankDish());
  markDirty();
  renderRows();
  renderCats();
  const names = document.querySelectorAll(".f-name");
  names[names.length - 1].focus();
});

$("editor").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("saveBtn");
  btn.disabled = true;
  setMsg($("saveMsg"), "Saving…");
  try {
    await api("/api/menu", { method: "PUT", body: JSON.stringify(items) });
    dirty = false;
    setMsg($("saveMsg"), "Saved. The live menu is updated.", "ok");
  } catch (err) {
    if (err.status === 401) {
      showView(false);
      setMsg($("loginMsg"), "Your session expired. Log in again, then save.", "error");
    } else {
      setMsg($("saveMsg"), err.message, "error");
    }
  } finally {
    btn.disabled = false;
  }
});

window.addEventListener("beforeunload", e => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

(async () => {
  try {
    const { admin } = await api("/api/session");
    if (admin) await loadEditor();
    showView(admin);
  } catch {
    showView(false);
    setMsg($("loginMsg"), "Cannot reach the server. Make sure it is running.", "error");
  }
})();
