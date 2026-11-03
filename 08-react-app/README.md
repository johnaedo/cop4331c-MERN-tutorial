# Step 8 — Create the React App

**You'll end with:** a second project, `cards-frontend`: a React app built with Vite and TypeScript, styled with Bootstrap, with page routing, running at `http://localhost:8000`.
**Time:** about 60 minutes.

---

## What you'll learn

- **React** builds a page out of **components**: functions that return what should appear on screen. Components are written in **JSX**, which looks like HTML inside JavaScript. When a component's data changes, React updates the page to match.
- **TypeScript** is JavaScript with **types**: you say what kind of value a variable or function expects, and the editor catches mistakes before you run anything. Files with JSX in them end in `.tsx`.
- **Vite** is the build tool. During development it serves your code instantly and updates the browser the moment you save (**hot module replacement**). For production, `npm run build` turns everything into a few small, optimized files in `dist/`.
- **React Router** shows a different page for each URL (`/` for login, `/cards` for the collection) without reloading the browser.
- **Bootstrap** provides ready-made styles: you add class names like `btn btn-primary` instead of writing CSS.

## 1. Create the project

The usual way to start a project like this is `npm create vite@latest`, which asks a few questions and generates a template. This step's `files/` folder holds that same template, already configured for this course, so everyone starts from identical files:

```bash
$ mkdir -p "$WORKSPACE/cards-frontend"
$ cd "$WORKSPACE/cards-frontend"
$ git init
$ cp -r "$TUTORIALS/08-react-app/files/." "$WORKSPACE/"
$ npm install
```

```text
cards-frontend/
├── index.html               the one HTML page; React fills in <div id="root">
├── package.json             dependencies and scripts
├── vite.config.ts           Vite settings
├── tsconfig*.json           TypeScript settings
├── eslint.config.js         code-quality rules (npm run lint)
├── .env.development         API address while developing
├── .env.production          API address for the deployed site (empty: same site)
├── Dockerfile, docker-compose.yml, .dockerignore
├── public/vite.svg          files served as-is (the browser tab icon)
└── src/
    ├── main.tsx             starts React and loads Bootstrap
    ├── App.tsx              the routes: which page shows for which URL
    ├── index.css, App.css   a few global styles
    ├── vite-env.d.ts        types for environment variables
    ├── assets/react.svg
    ├── components/PageTitle.tsx
    └── pages/LoginPage.tsx
```

## 2. Run it

```bash
$ npm run dev
  VITE v7.x.x  ready in 300 ms
  ➜  Local:   http://localhost:8000/
```

Open <http://localhost:8000>. You'll see the course title and a line saying the login form arrives in Step 9. Try <http://localhost:8000/anything/else> too: you're sent back to `/`.

Leave it running, open `src/components/PageTitle.tsx`, change the title text, and save. The browser updates instantly without reloading. That's hot module replacement. Change it back.

## 3. Read the code

### `index.html` and `src/main.tsx`

`index.html` is nearly empty: a `<div id="root"></div>` and a script tag for `src/main.tsx`. Everything you see is drawn by React into that div:

```tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Importing a CSS file makes Vite include it in the page. `<App />` is a component: everything starts there. `StrictMode` makes React warn about common mistakes while developing.

### `src/App.tsx`: routing

```tsx
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
```

`<Routes>` picks the first `<Route>` whose `path` matches the URL and shows its `element`. `path="*"` matches anything else and `<Navigate>` redirects it to `/`. In Step 9 you'll add a `/cards` route.

### `src/components/PageTitle.tsx` and `src/pages/LoginPage.tsx`

A component is a function that returns JSX:

```tsx
function PageTitle() {
  return (
    <header className="text-center py-4 mb-4 border-bottom bg-white shadow-sm rounded-3">
      <h1 id="title" className="h2 fw-bold text-primary ...">
        <i className="bi bi-layers-fill" aria-hidden="true"></i>
        COP 4331 MERN Stack Demo
      </h1>
      ...
    </header>
  );
}
```

Two JSX differences from HTML: **`className`** instead of `class` (because `class` is a JavaScript keyword), and `{ }` braces to insert JavaScript values. The class names are Bootstrap's: `text-center`, `py-4` (vertical padding), `text-primary` (the theme's blue). `bi bi-layers-fill` is a Bootstrap Icons icon.

This project separates **pages** (one per URL, in `src/pages/`) from **components** (reusable pieces, in `src/components/`). `LoginPage` is a page made of the `PageTitle` component plus, for now, a placeholder.

### `.env.development`, `.env.production`, and `src/vite-env.d.ts`

```text
VITE_API_BASE_URL=http://localhost:5000
```

The frontend needs to know where the API is, and that's different while developing (your laptop) and in production (your droplet). Vite reads `.env.development` for `npm run dev` and `.env.production` for `npm run build`, and makes the value available in code as `import.meta.env.VITE_API_BASE_URL`.

`.env.production` sets `VITE_API_BASE_URL=` to nothing, on purpose. On your droplet, one web address will serve both the app and the API, so the built app can simply call `/api/...` on whatever site it was loaded from. Step 13 explains how.

Only variables starting with **`VITE_`** reach your code. That's a safety feature: everything in the frontend is sent to every visitor's browser, so **a frontend `.env` must never hold secrets**. (That's why these two files are committed to Git, unlike the backend's `.env`.)

`vite-env.d.ts` tells TypeScript that `VITE_API_BASE_URL` exists and is a string.

### `vite.config.ts`

```ts
server: {
  host: '0.0.0.0',
  port: 8000,
  watch: { usePolling: true },
},
```

Port 8000 instead of Vite's default 5173; `host: '0.0.0.0'` and `usePolling` make the dev server work inside Docker.

## 4. Build it for production

Stop the dev server (**Ctrl+C**) and run:

```bash
$ npm run build
$ ls dist/assets
$ npm run preview
```

`npm run build` first type-checks every file (`tsc -b`) and stops if there's a type error, then bundles the app into `dist/`: one HTML file plus a few JavaScript and CSS files. Those static files are the whole frontend; any web server can send them. `npm run preview` serves `dist/` at <http://localhost:4173> so you can check the production build.

Also try the linter, which checks for common mistakes:

```bash
$ npm run lint
```

No output means no problems.

## 5. Optional: run it in Docker

Like the backend, the frontend can run in a container: `docker compose up --build` starts the Vite dev server at <http://localhost:8000>. You'll use `npm run dev` in the steps ahead because it's faster, but both work.

## 6. Save your work to GitHub

Create a **cards-frontend** repository on GitHub (empty, like in Step 1), then:

```bash
$ git add .
$ git commit -m "Step 8: React app"
$ git remote add origin git@github.com:YOUR-USERNAME/cards-frontend.git
$ git push -u origin main
```

`dist/` and `node_modules/` are in `.gitignore`, so they aren't committed.

---

## Check your work

- [ ] <http://localhost:8000> shows the course title and the Step 9 placeholder
- [ ] Any other path redirects to `/`
- [ ] `npm run build` succeeds and creates `dist/`
- [ ] `npm run lint` prints no problems
- [ ] Your `cards-frontend` code is on GitHub

## Troubleshooting

- **`Port 8000 is already in use`** — another program (or the Docker version of this app) is using it. Stop it, or run `npx vite --port 8001`.
- **The page is unstyled** — a Bootstrap import is missing from `src/main.tsx`, or `npm install` didn't finish.
- **Type errors in VS Code that `npm run build` doesn't show** — VS Code may be using a different TypeScript version. Open any `.ts` file, press **Ctrl+Shift+P**, choose **TypeScript: Select TypeScript Version**, and pick **Use Workspace Version**.

**Stuck?** Compare your project with `checkpoint/cards-frontend/`.

**Next:** [Step 9 — Login and register](../09-login-and-register/README.md)
