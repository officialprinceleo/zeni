const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist");

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, "public"), out, { recursive: true });
fs.copyFileSync(path.join(root, "menu.json"), path.join(out, "menu.json"));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("Built static site in dist/");
