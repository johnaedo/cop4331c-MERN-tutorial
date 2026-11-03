# Step 5 — Automated Tests

**You'll end with:** 27 tests that check the whole API, including the security rules, and run with one command in a few seconds.
**Time:** about 45 minutes.

---

## What you'll learn

Bruno tests your API from the *outside*, against a running server and your real database. That's great for exploring, but it depends on whatever data happens to be in the database, and you have to start everything first. **Automated tests** run your code in isolation, from a clean slate, every time, so you can change code confidently: if you break something, a test fails.

- **Vitest** is the test runner. You write `test('description', async () => { ... })` blocks with `expect(...)` assertions; Vitest runs them and reports what passed.
- **Supertest** sends HTTP requests straight to your Express `app` *without opening a port*. That's why `server.js` exports `app` and only calls `listen` when run directly.
- **mongodb-memory-server** starts a throwaway MongoDB that lives in memory. Each test run gets a fresh, empty database, so tests can't damage your real data or each other.

These are **integration tests**: each one goes through the router, middleware, controller, model, and database together, just like a real request.

## 1. Install the test tools

```bash
$ cd "$WORKSPACE/cards-backend"
$ npm install --save-dev vitest supertest mongodb-memory-server
```

## 2. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/05-automated-tests/files/." "$WORKSPACE/"
```

```text
cards-backend/
├── package.json         (changed: "test": "vitest run", and the test tools)
└── tests/api.test.js    (new)
```

## 3. Read the tests

Open `tests/api.test.js`.

### Setting up and tearing down

```js
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test-secret';

  app = require('../server');
});

afterEach(async () => {
  await User.deleteMany({});
  await Card.deleteMany({});
});
```

- **`beforeAll`** runs once: start the in-memory database, point the app at it with environment variables, *then* load the app. (Order matters: `server.js` reads `MONGODB_URI` and `config/auth.js` reads `JWT_SECRET` the moment they're loaded.)
- **`afterEach`** empties both collections after every test, so each test starts clean and no test depends on another.
- **`afterAll`** disconnects and stops the database.

### A helper that registers a user

```js
const register = async (login = 'tester', password = 'secret123') => {
  const res = await request(app).post('/api/users').send({ login, password, ... });
  return res.body;   // { token, user }
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });
```

Most tests need a logged-in user, so they start with `const { token, user } = await register();` and send `.set(auth(token))`.

### A typical test

```js
test('PATCH /api/cards/:id updates only the fields sent', async () => {
  const { token, user } = await register();
  const card = await Card.create({ ...sampleCard, userId: user._id });

  const res = await request(app)
    .patch(`/api/cards/${card._id}`)
    .set(auth(token))
    .send({ cardValue: 2 });

  expect(res.status).toBe(200);
  expect(res.body.cardValue).toBe(2);
  expect(res.body.playerName).toBe('Player 1');
});
```

Every test follows the same three parts: **arrange** (create the data it needs), **act** (send one request), **assert** (check the result).

### Testing the security rules

The most valuable tests prove that bad things *don't* happen:

| Test | Proves |
|---|---|
| stores a hash, never the plain-text password | the pre-save hook works |
| never returns the password | `select: false` and `toJSON` work |
| ignores a role sent by the client | nobody can register as an admin |
| is not fooled by a MongoDB operator in the body | the NoSQL-injection fix works |
| return 401 without a token / with an invalid token | `requireAuth` works |
| returns 403 for someone else's account / card | `requireSelf` and `loadOwnedCard` work |
| PATCH ignores attempts to move a card to another user | the `pickCardFields` whitelist works |

## 4. Run the tests

Run them **on your computer, not in Docker**. (mongodb-memory-server doesn't run on Alpine Linux, which the container uses.)

```bash
$ npm run test
```

The first run downloads a MongoDB binary (around 100 MB), so give it a minute. After that:

```text
 ✓ tests/api.test.js (27 tests) 2104ms

 Test Files  1 passed (1)
      Tests  27 passed (27)
```

Watch a test catch a bug: in `controllers/cardsController.js`, change the ownership check from `!==` to `===`, and run `npm test` again. Several tests fail and tell you exactly which rule broke. Change it back.

While working on code, `npx vitest` (without `run`) keeps watching your files and reruns the tests on every save. Press **q** to quit.

## 5. Commit

```bash
$ git add .
$ git commit -m "Step 5: automated tests"
$ git push
```

---

## Check your work

- [ ] `npm test` shows **27 passed**
- [ ] Breaking the ownership check makes tests fail, and fixing it makes them pass again

## Troubleshooting

- **`DownloadError: Download failed`** — the first run couldn't download MongoDB. Check your internet connection and try again. On some Linux distributions, set the version it downloads to one that supports your system: `MONGOMS_VERSION=7.0.14 npm test`.
- **`Instance failed to start ... libcrypto`** — your Linux is missing an OpenSSL library MongoDB needs. On Ubuntu/WSL: `sudo apt install -y libssl3` (or `libssl-dev`).
- **Tests time out on the first run** — the download is slow. Run `npm test` again once it finishes.
- **`Error: JWT_SECRET is not set`** — `server.js` was loaded before `process.env.JWT_SECRET` was set. Keep the `require('../server')` line *after* the environment variables in `beforeAll`.

**Stuck?** Compare your project with `checkpoint/cards-backend/`.

**Next:** [Step 6 — API documentation](../06-api-docs/README.md)
