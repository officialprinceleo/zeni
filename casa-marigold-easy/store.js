const MENU_KEY = "cm_menu";
const PW_KEY = "cm_pw";
const SESSION_KEY = "cm_in";

function quickHash(s) {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
  return String(x >>> 0);
}

const BASE_HASH = quickHash(JSON.stringify(window.MENU));

function loadMenu() {
  try {
    const s = JSON.parse(localStorage.getItem(MENU_KEY));
    if (s && s.base === BASE_HASH && Array.isArray(s.items)) return s.items;
  } catch {}
  return JSON.parse(JSON.stringify(window.MENU));
}

function saveMenu(items) {
  localStorage.setItem(MENU_KEY, JSON.stringify({ base: BASE_HASH, items }));
}

function resetMenu() {
  localStorage.removeItem(MENU_KEY);
}

async function hashPassword(pw) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("cm:" + pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return "q" + quickHash("cm:" + pw);
}
