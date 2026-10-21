# Step 1 — Hello Express

**You'll end with:** a tiny API that answers `GET /api/ping`, running first on your computer and then in Docker, and a Bruno test that checks it.
**Time:** about 45 minutes.

---

## What you'll learn

- **Node.js** runs JavaScript outside the browser. A Node program can open a network port and answer HTTP requests, which is all a web server is.
- **Express** is a small framework on top of Node that makes this easier. You give Express *routes*: "when a `GET` request arrives for `/api/ping`, run this function."
- **npm** installs packages (Express and friends) and records them in `package.json`.
- **Docker** packages your app with everything it needs into an *image*, and runs it as a *container*. **Docker Compose** starts one or more containers from a single file, `docker-compose.yml`.
- **Bruno** sends requests to your API and checks the answers.

## 1. Create the project

```bash
$ mkdir -p "$WORKSPACE/cards-backend"
$ cd "$WORKSPACE/cards-backend"
$ git init
$ npm init -y
$ npm install express cors dotenv
$ npm install --save-dev nodemon
```

`npm init -y` created a `package.json`; the `install` commands added your dependencies to it and downloaded them into `node_modules/`.

- **express** — the web framework
- **cors** — lets a web page from a different address (your React app, later) call this API
- **dotenv** — loads settings from a `.env` file into `process.env`
- **nodemon** — restarts the server automatically whenever you save a file. It's a *dev* dependency: needed while developing, not to run the app.

## 2. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/01-hello-express/files/." "$WORKSPACE/"
```

That added these files to `cards-backend/` (and replaced `package.json`):

```text
cards-backend/
├── package.json
├── server.js
├── .gitignore
├── .env.example
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
└── api-tests/
    ├── opencollection.yml
    ├── Ping.yml
    └── environments/
        ├── Development.yml
        └── Production.yml
```

Now open each one in VS Code (`code .`) and read along.

### `package.json`

The important part is `scripts`, shortcuts you run with `npm run <name>`:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon ./server.js"
}
```

`npm start` runs the server once; `npm run dev` runs it with nodemon so it restarts on every save.

### `server.js`

This is the whole API for now:

```js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// GET /api/ping - Health check
app.get('/api/ping', (req, res) => {
  res.status(200).json({ message: 'Hello World' });
});
```

- `app.use(...)` adds **middleware**: functions that run on *every* request before your routes. `express.json()` reads a JSON request body and puts it in `req.body`; `cors()` adds the headers browsers need before they'll let a page from another address read the response.
- `app.get('/api/ping', handler)` is a **route**. The handler gets the request (`req`) and the response (`res`). `res.status(200).json({...})` sends status code **200 OK** with a JSON body.

The end of the file starts the server:

```js
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
```

`require.main === module` is true only when you run `node server.js` directly. In Step 5 a test file will `require('./server')` to test the app *without* opening a port, which is why the app is also exported.

### `.env.example` and `.gitignore`

Settings that differ between computers (ports, passwords, secrets) go in a file called `.env`, which **never** goes into Git; `.gitignore` already excludes it. `.env.example` is the committed template that shows which settings exist.

```bash
$ cp .env.example .env
```

### `Dockerfile`, `.dockerignore`, `docker-compose.yml`

The **Dockerfile** is the recipe for your image: start from Node 22 on Alpine Linux, copy `package.json`, run `npm install`, copy your code, and run `npm run dev`. `.dockerignore` keeps `node_modules` and secrets out of the image.

**`docker-compose.yml`** describes how to run it:

```yaml
services:
  api:
    build: ...
    ports:
      - "5000:5000"
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
    command: npm run dev
```

- `ports: "5000:5000"` connects port 5000 on your computer to port 5000 in the container.
- `.:/usr/src/app` mounts your project folder into the container, so when you save a file, nodemon *inside* the container sees the change and restarts.
- `/usr/src/app/node_modules` keeps the container's own `node_modules` (installed for Linux) from being replaced by yours.

### `api-tests/`

A **Bruno collection**: each `.yml` file is one saved request, with tests. `Ping.yml` sends `GET {{baseURL}}/api/ping` and checks the answer:

```js
test("responds 200 with a message", function () {
  expect(res.getStatus()).to.equal(200);
  expect(res.getBody().message).to.equal("Hello World");
});


`{{baseURL}}` comes from an **environment**: `environments/Development.yml` sets it to `http://localhost:5000`. `Production.yml` will point at your server in Step 7.

## 3. Run it on your computer

```bash
$ npm run dev
[nodemon] starting `node ./server.js`
Server running on port 5000
```

In a browser, open <http://localhost:5000/api/ping>. You should see:

```json
{"message":"Hello World"}
```

Change `'Hello World'` in `server.js` to something else and save: nodemon restarts and the browser shows the new text after a refresh. Change it back, then stop the server with **Ctrl+C**.

## 4. Run it in Docker

```bash
$ docker compose up --build
```

The first build takes a minute. When you see `Server running on port 5000`, the same URL works again, but now the server is running inside a container. Stop it with **Ctrl+C**.

From now on you'll usually run the backend this way. To run it in the background instead, add `-d` (`docker compose up --build -d`); then `docker compose logs -f api` shows its output and `docker compose down` stops it.

## 5. Test it with Bruno

1. Start the API (`docker compose up --build`).
2. In Bruno, choose **Open Collection** and select the `cards-backend/api-tests` folder.
3. In the top-right environment menu, select **Development**.
4. Open **Ping** and click the arrow to send it. The **Tests** tab should show one passing test.

## 6. Save your work to GitHub

```bash
$ git add .
$ git commit -m "Step 1: Hello Express"
```

On GitHub, create a new repository named **cards-backend** (no README, no .gitignore — you already have them). Then connect and push, using the SSH address GitHub shows you:

```bash
$ git remote add origin git@github.com:YOUR-USERNAME/cards-backend.git
$ git push -u origin main
```

From now on, end every step with `git add .`, `git commit`, and `git push`.

---

## Check your work

- [ ] <http://localhost:5000/api/ping> shows `{"message":"Hello World"}` while `docker compose up` is running
- [ ] The Bruno **Ping** request passes its test
- [ ] `git status` shows nothing to commit, and your code is on GitHub
- [ ] `.env` and `node_modules/` are **not** on GitHub

## Troubleshooting

- **`Error: listen EADDRINUSE: address already in use :::5000`** — something else is using port 5000: probably your `npm run dev` from earlier, or a container that's still running. Stop it (Ctrl+C, or `docker compose down`). On macOS, AirPlay Receiver also uses port 5000: turn it off in **System Settings → General → AirDrop & Handoff**.
- **Bruno: `connect ECONNREFUSED`** — the API isn't running, or you didn't select the **Development** environment.
- **Changes don't appear in Docker** — check you're editing the files in the folder you started Compose from.

**Stuck?** Compare your project with `checkpoint/cards-backend/`.

**Next:** [Step 2 — MongoDB](../02-mongodb/README.md)
