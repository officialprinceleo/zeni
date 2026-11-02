# Casa Marigold

Restaurant menu website with food cards, category tabs, a vegetarian filter, and a password-protected admin editor.

## Structure

```
public/            Website (HTML, CSS, JS)
menu.json          Menu data
server.js          Node server with the admin API (no dependencies)
scripts/           Build script for GitHub Pages
.github/workflows/ Auto-deploy to GitHub Pages
```

## Deploy to GitHub Pages (free)

1. Create a repo on GitHub and push this folder to the `main` branch.
2. In the repo go to **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push any change. The site appears at `https://<username>.github.io/<repo>/` after about a minute.

To change the menu on Pages, edit `menu.json` on GitHub (pencil icon) and commit. The site redeploys automatically.

GitHub Pages is static, so the admin login does not work there.

## Run locally with the admin editor

Needs Node.js 18+.

```
ADMIN_PASSWORD="your-password" npm start
```

Windows (cmd): `set ADMIN_PASSWORD=your-password && npm start`

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin

Without `ADMIN_PASSWORD` the password is `changeme`. Set your own before going live.

## Host the admin editor online

Any Node host works (Render, Railway, Fly.io). Use start command `npm start` and set `ADMIN_PASSWORD` as an environment variable. Admin edits are written to `menu.json`, so the host needs a persistent disk. Without one, edits are lost when the app restarts or redeploys.
