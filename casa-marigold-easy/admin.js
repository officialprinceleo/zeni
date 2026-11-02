const $ = id => document.getElementById(id);
let items = [];
let dirty = false;

function showView(name) {
  $("loginView").hidden = name === "editor";
  $("editorView").hidden = name !== "editor";
  $("logout").hidden = name !== "editor";
  if (name !== "editor") $("password").focus();
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

function openEditor() {
  items = loadMenu();
  dirty = false;
  renderRows();
  renderCats();
  setMsg($("saveMsg"), "");
  showView("editor");
}

function prepareLogin() {
  const hasPw = !!localStorage.getItem(PW_KEY);
  $("loginTitle").textContent = hasPw ? "Admin login" : "Create admin password";
  $("loginHelp").textContent = hasPw ? "" : "First time here. Choose a password you will remember.";
  $("loginBtn").textContent = hasPw ? "Log in" : "Create password";
  $("password").autocomplete = hasPw ? "current-password" : "new-password";
  showView("login");
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  setMsg($("loginMsg"), "");
  const stored = localStorage.getItem(PW_KEY);
  const hash = await hashPassword($("password").value);
  if (!stored) {
    localStorage.setItem(PW_KEY, hash);
  } else if (stored !== hash) {
    setMsg($("loginMsg"), "Wrong password", "error");
    return;
  }
  sessionStorage.setItem(SESSION_KEY, "1");
  $("password").value = "";
  openEditor();
});

$("logout").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  dirty = false;
  prepareLogin();
});

$("addBtn").addEventListener("click", () => {
  items.push(blankDish());
  markDirty();
  renderRows();
  renderCats();
  const names = document.querySelectorAll(".f-name");
  names[names.length - 1].focus();
});

$("editor").addEventListener("submit", e => {
  e.preventDefault();
  saveMenu(items);
  dirty = false;
  setMsg($("saveMsg"), "Saved. Open the site in this browser to see it.", "ok");
});

$("downloadBtn").addEventListener("click", () => {
  const text = "window.MENU = " + JSON.stringify(items, null, 2) + ";\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "menu.js";
  a.click();
  URL.revokeObjectURL(url);
});

$("resetBtn").addEventListener("click", () => {
  if (!confirm("Throw away your saved changes and go back to the menu in menu.js?")) return;
  resetMenu();
  openEditor();
  setMsg($("saveMsg"), "Changes undone.", "ok");
});

window.addEventListener("beforeunload", e => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

if (sessionStorage.getItem(SESSION_KEY) && localStorage.getItem(PW_KEY)) openEditor();
else prepareLogin();
