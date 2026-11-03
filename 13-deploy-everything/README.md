# Step 13 — Deploy Everything

**You'll end with:** the whole app live at `https://YOUR-HOSTNAME`, with the React frontend and the API served together over HTTPS by Apache on your droplet, and a GitHub Actions pipeline that lints, builds, and redeploys the frontend every time you push.
**Time:** about 60 minutes.

---

## What you'll learn

- A built React app is just **static files**: `npm run build` produces HTML, CSS, and JavaScript in `dist/`. Any web server can send them. You'll use **Apache**, which is already running on your droplet and already serving your API from Step 7.
- **One site, two halves.** The browser loads the app from `https://YOUR-HOSTNAME/` and calls the API at `https://YOUR-HOSTNAME/api/...`. Apache sends the first kind of request to files on disk and *reverse proxies* the second to Node. Because both come from the same address, the app needs no API address of its own, no CORS permission, and gets HTTPS for free.
- **Client-side routing needs one server rule.** Visiting `/cards` directly asks Apache for a file called `cards`, which doesn't exist. Apache must answer with `index.html` instead and let React Router pick the page.
- **CI/CD for the frontend.** GitHub Actions lints and builds the app on GitHub's computers, then copies only the finished files to the droplet.

```text
 https://YOUR-HOSTNAME/cards        ──► Apache ──► /var/www/cards/index.html   (React app)
 https://YOUR-HOSTNAME/assets/...   ──► Apache ──► /var/www/cards/assets/...   (JS, CSS)
 https://YOUR-HOSTNAME/api/...      ──► Apache ──► 127.0.0.1:5000 ──► Node API ──► Atlas
```

## Before you start

- Step 7 is done: `https://YOUR-HOSTNAME/api/ping` answers, and `https://YOUR-HOSTNAME/` shows the placeholder page *The Cards frontend arrives in Step 13*.
- You still have the `~/.ssh/cards_actions` key from Step 7.
- Your `cards-frontend` is pushed to GitHub, with all Step 12 tests passing.

## 1. How the built app finds the API

Open `cards-frontend/.env.production`:

```text
VITE_API_BASE_URL=
```

It's empty on purpose. Now look at `src/utils/buildPath.ts` from Step 9:

```ts
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
```

- While developing (`npm run dev`), Vite reads `.env.development`, so `baseUrl` is `http://localhost:5000` and `buildPath("api/auth/login")` gives `http://localhost:5000/api/auth/login`.
- In the production build (`npm run build`), `baseUrl` is empty, so `buildPath("api/auth/login")` gives just `/api/auth/login`. A URL that starts with `/` means "on the same site this page came from." Loaded from `https://YOUR-HOSTNAME`, the app calls `https://YOUR-HOSTNAME/api/auth/login`, which Apache passes to the API.

That's also why it uses **`??`** instead of `||`: `||` would treat the empty string as "missing" and fall back to `localhost:5000`, which on a user's computer is nothing at all. `??` falls back only when the variable isn't defined.

So there's **nothing to edit**: the same build works whatever your hostname is, and works over HTTPS without any change.

## 2. The frontend half of your Apache site

You installed the site in Step 7, so Apache is already set up to serve the frontend. Here's the part of `deploy/apache-cards.conf` (in your **cards-backend** project) you skipped then:

```apache
    DocumentRoot /var/www/cards

    <Directory /var/www/cards>
        Require all granted
        Options -Indexes
        AllowOverride None
        FallbackResource /index.html
    </Directory>

    <Directory /var/www/cards/assets>
        FallbackResource disabled
    </Directory>
```

- **`DocumentRoot /var/www/cards`**: requests that aren't for `/api` are answered from this folder. `/` sends `index.html`; `/assets/index-abc123.js` sends that file.
- **`Require all granted`**: anyone may read these files (they're a public website).
- **`Options -Indexes`**: never show a folder's file list. **`AllowOverride None`**: ignore `.htaccess` files, so the configuration lives in one place.
- **`FallbackResource /index.html`**: the routing rule. When there's no file for the path (like `/cards`), send `index.html`, and React Router shows the right page. Without it, reloading `/cards` would be a 404.
- **`FallbackResource disabled` for `/assets`**: a missing *script* should be a plain 404. Otherwise the browser would get `index.html` and try to run HTML as JavaScript, which gives confusing errors after a deploy.

Notice that `/api` requests never reach `FallbackResource`: `ProxyPass` handles them first and passes them to Node.

## 3. Deploy once by hand

Before automating it, do it yourself once. On **your computer**:

```bash
$ cd "$WORKSPACE/cards-frontend"
$ npm run build
$ ls dist
assets  index.html  vite.svg
$ rsync -az --delete dist/ deploy@YOUR-SERVER:/var/www/cards/
```

- **`npm run build`** type-checks the code and writes the finished site to `dist/`.
- **`rsync`** copies the *contents* of `dist/` (the trailing `/` matters) into `/var/www/cards`, logged in as the `deploy` user, which owns that folder (Step 7, part 3). **`--delete`** removes the placeholder page and any files from older builds.

No `rsync` on your computer? Use `scp -r dist/* deploy@YOUR-SERVER:/var/www/cards/` instead (it doesn't delete old files, but that's fine for now).

Now open `https://YOUR-HOSTNAME` in your browser:

- The padlock is in the address bar.
- The badge under the login heading says **PLEASE LOG IN: Production**.
- Log in as `johnaedo` / `ucf123!` (you seeded this account in Step 7), add a card, then reload `/cards`. Everything from Steps 9–11 works, now on the internet.

Open the browser's developer tools, **Network** tab, and log in again: the `login` request goes to `https://YOUR-HOSTNAME/api/auth/login`, the same address as the page.

## 4. Automate it with GitHub Actions

Running `npm run build` and `rsync` after every change gets old fast. A **workflow** can do it for you.

### Copy in the workflow

On your computer:

```bash
$ cp -r "$TUTORIALS/13-deploy-everything/files/." "$WORKSPACE/"
```

That adds `cards-frontend/.github/workflows/main.yaml`. GitHub runs any workflow file in `.github/workflows/` automatically.

### Read the workflow

It's a close cousin of the backend's `deploy.yml` from Step 7.

```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

**When** it runs: on every push and pull request to your main branch.

```yaml
      - uses: actions/checkout@v4          # get the code
      - uses: actions/setup-node@v4        # install Node 26
      - run: npm ci                        # install exact dependencies (Cypress skipped)
      - run: npm run lint
      - run: npm run build                 # type-check and build into dist/
```

This part is *continuous integration*. It runs on a fresh machine at GitHub. If lint or the build fails, the workflow stops here, so **broken code never reaches your server**.

```yaml
      - name: Copy the build to the droplet
        if: github.event_name == 'push' && env.SSH_HOST != ''
        run: rsync -az --delete --no-owner --no-group -e "ssh -i ~/.ssh/deploy_key" dist/ "$SSH_USER@$SSH_HOST:$SITE_DIR/"
```

This part is *continuous deployment*, for pushes only. It's the same `rsync` you ran by hand in part 3. The site is built on GitHub, so the droplet doesn't need the frontend's source code, its `node_modules`, or any build tools; it only receives the finished files. Apache serves new files immediately, so there's nothing to restart.

### Add the secrets

The workflow logs in exactly as the backend's does: as `deploy`, with the `cards_actions` key from Step 7. Secrets belong to one repository, though, so add the same three to this one.

On GitHub, open the **cards-frontend** repository → **Settings → Secrets and variables → Actions** → **Secrets** tab, and click **New repository secret** for each:

| Name | Value |
|---|---|
| `SSH_HOST` | your droplet's IP address |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | the **entire** output of `cat ~/.ssh/cards_actions`, from `-----BEGIN` to `END ... KEY-----` |

### Push and watch

```bash
$ cd "$WORKSPACE/cards-frontend"
$ git add .github
$ git commit -m "Step 13: deploy with GitHub Actions"
$ git push
```

On GitHub, open the **Actions** tab and click the running workflow. Every step should get a green check, ending with **Copy the build to the droplet**.

### Prove it works

Make a visible change: for example, the subtitle in `src/components/PageTitle.tsx`. Commit and push it. When the workflow finishes, reload `https://YOUR-HOSTNAME`: your change is live, and you didn't touch the server.

---

## Check your work

- [ ] `https://YOUR-HOSTNAME` shows the app with a padlock and **PLEASE LOG IN: Production**
- [ ] `http://YOUR-HOSTNAME` redirects to `https://`
- [ ] You can log in, add, edit, and delete cards on the live site
- [ ] Reloading `https://YOUR-HOSTNAME/cards` works (no 404)
- [ ] In the Network tab, API requests go to `https://YOUR-HOSTNAME/api/...`, not `localhost` and not port 5000
- [ ] A push to GitHub triggers a workflow that passes every step, and a visible change appears on the live site without touching the server

## You're done

You've built and deployed a complete MERN application:

- a REST API with hashed passwords, token authentication, and per-user authorization
- a MongoDB database in Atlas, open only to your droplet (and your laptop, if you use Compass)
- a React and TypeScript frontend that talks to the API
- one HTTPS site in front of both, with the API's port never exposed to the internet
- integration tests for the API, end-to-end tests for the frontend, and pipelines that deploy only code that passes its checks

Ideas for going further:

- **Run the Cypress tests in the pipeline**, before deploying.
- **Harden the droplet:** turn off SSH logins as `root`, and remove the `johnaedo` test account from the live database.
- **New features:** sorting, card photos, sharing a collection with another user.

## Troubleshooting

- **`https://YOUR-HOSTNAME` still shows *The Cards frontend arrives in Step 13*** — the files didn't arrive. Check the `rsync` output (or the Actions log), and that you copied `dist/`, not the project folder.
- **The site shows a file list, or `403 Forbidden`** — `/var/www/cards` is empty or has your files one folder too deep (like `/var/www/cards/dist/index.html`). Run `rsync` again with the trailing `/` on `dist/`.
- **The droplet's old default page appears instead of the app** — you visited the IP address, not the hostname. The Cards site only answers to `YOUR-HOSTNAME`.
- **Reloading `/cards` gives 404** — the `FallbackResource /index.html` line is missing from the installed Apache site (`/etc/apache2/sites-available/cards.conf` and `cards-le-ssl.conf`).
- **The page is blank, and the console shows `Failed to load module script`** — the browser is using an old `index.html` that points at deleted files. Reload with **Ctrl+Shift+R** (**Cmd+Shift+R** on a Mac).
- **Login fails with `Failed to fetch`, and the Network tab shows a request to `localhost:5000`** — `.env.production` isn't empty, or `buildPath.ts` uses `||` instead of `??`. Fix it, then build and deploy again.
- **Login fails with `503`** — Apache is fine, but the API is down. See Step 7's troubleshooting, starting with `systemctl --user status cards-api` (as `deploy`).
- **Actions: `Permission denied (publickey)`** — check the three secrets in the **cards-frontend** repository: `SSH_USER` is `deploy`, and `SSH_PRIVATE_KEY` is the *private* key, pasted in full.
- **Actions: `rsync: ... Permission denied`** — `/var/www/cards` isn't owned by `deploy`. On the droplet as root: `chown -R deploy:deploy /var/www/cards`.
- **The Actions run says *Deploy skipped*** — the repository secrets aren't set in this repository.

**Stuck?** Compare your project with `checkpoint/cards-frontend/`.
