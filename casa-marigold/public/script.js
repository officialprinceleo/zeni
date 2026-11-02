const tabs = document.getElementById("tabs");
const grid = document.getElementById("grid");
const vegOnly = document.getElementById("vegOnly");
const dialog = document.getElementById("dialog");
let menu = [];
let cats = ["All"];
let active = "All";

const price = p => "$" + (Number.isInteger(p) ? p : p.toFixed(2));

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function renderTabs() {
  tabs.replaceChildren();
  cats.forEach(c => {
    const b = el("button", "tab", c);
    b.role = "tab";
    b.setAttribute("aria-selected", c === active);
    b.onclick = () => { active = c; renderTabs(); renderGrid(); };
    tabs.appendChild(b);
  });
}

function renderGrid() {
  const items = menu.filter(i => (active === "All" || i.cat === active) && (!vegOnly.checked || i.veg));
  grid.replaceChildren();
  if (!items.length) {
    grid.appendChild(el("p", "empty", "No dishes match. Turn off the vegetarian filter or pick another category."));
    return;
  }
  items.forEach(i => {
    const card = el("button", "card");
    card.style.setProperty("--tint", i.tint);
    const art = el("div", "card-art", i.emoji);
    art.setAttribute("aria-hidden", "true");
    const body = el("div", "card-body");
    const top = el("div", "card-top");
    top.append(el("h3", "", i.name), el("span", "price", price(i.price)));
    body.append(top, el("p", "", i.desc));
    if (i.veg) body.appendChild(el("span", "badge", "Vegetarian"));
    card.append(art, body);
    card.onclick = () => openDialog(i);
    grid.appendChild(card);
  });
}

function openDialog(i) {
  dialog.style.setProperty("--tint", i.tint);
  document.getElementById("dEmoji").textContent = i.emoji;
  document.getElementById("dName").textContent = i.name;
  document.getElementById("dDesc").textContent = i.desc;
  document.getElementById("dTags").textContent = i.veg ? "Vegetarian" : i.cat;
  document.getElementById("dPrice").textContent = price(i.price);
  dialog.showModal();
}

async function loadMenuData() {
  for (const url of ["/api/menu", "menu.json", "../menu.json"]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) return data;
    } catch {}
  }
  throw new Error("No menu data");
}

async function init() {
  try {
    menu = await loadMenuData();
  } catch {
    grid.appendChild(el("p", "empty", "The menu could not be loaded. Refresh the page to try again."));
    return;
  }
  cats = ["All", ...new Set(menu.map(i => i.cat))];
  if (!cats.includes(active)) active = "All";
  renderTabs();
  renderGrid();
}

document.getElementById("close").onclick = () => dialog.close();
dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
vegOnly.addEventListener("change", renderGrid);
init();
