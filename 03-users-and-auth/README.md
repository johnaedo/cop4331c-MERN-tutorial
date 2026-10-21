# Step 3 — Users and Authentication

**You'll end with:** an API where people can register and log in, passwords are stored safely, and a protected route only answers when a valid login token is sent with the request.
**Time:** about 90 minutes. This is the longest backend step; take it slowly.

---

## What you'll learn

- **Routers and controllers.** As an API grows, one `server.js` full of routes becomes unreadable. Express **routers** group related routes into their own files, and **controllers** hold the code that does the work. You'll move to this layout now.
- **REST.** URLs name *things* (`/api/users`), and the HTTP *method* says what to do to them (`POST` creates, `GET` reads). Status codes say what happened.
- **Password hashing.** You never store a password. You store a **hash**: a one-way scramble that can check a password but can't be turned back into one.
- **Tokens.** After logging in, the client gets a **JSON Web Token (JWT)**, a signed note saying "this is user 123, valid for one hour". The client sends it with every request, and the API checks the signature instead of asking for the password again.

## How a request flows through the app

```text
request ─► server.js ─► routes/index.js ─► routes/users.js ─► middleware ─► controller ─► model ─► MongoDB
            (cors, json)   (/api/...)        (/users/...)       (auth checks)   (the work)
                                                                                    │
response ◄──────────────────────────────── res.status(...).json(...) ◄──────────────┘
           (any error goes to middleware/errorHandler.js instead)
```

## 1. Install the new packages

```bash
$ cd "$WORKSPACE/cards-backend"
$ npm install bcryptjs jsonwebtoken
```

- **bcryptjs** — hashes and checks passwords with the bcrypt algorithm
- **jsonwebtoken** — creates and verifies JWTs

## 2. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/03-users-and-auth/files/." "$WORKSPACE/"
```

```text
cards-backend/
├── package.json, server.js, docker-compose.yml, .env.example   (changed)
├── seed.js                       (new)
├── config/auth.js                (new)
├── models/User.js                (changed: password hashing)
├── routes/
│   ├── index.js                  (new: mounts the routers under /api)
│   ├── auth.js                   (new: /api/auth/login)
│   └── users.js                  (new: /api/users)
├── controllers/
│   ├── authController.js         (new: login)
│   └── usersController.js        (new: register, get account)
├── middleware/
│   ├── auth.js                   (new: token checks)
│   ├── errorHandler.js           (new: 404s and errors)
│   └── validateObjectId.js       (new: rejects malformed ids)
└── api-tests/
    ├── Register.yml, Login.yml, Get My Account.yml, Missing Token.yml   (new)
    └── environments/Development.yml, Production.yml                    (changed)
```

## 3. Set your JWT secret

Every token is signed with a secret. Anyone who knows it can forge a token for any user, so it lives only in `.env`, never in Git. Create a fresh `.env` from the updated template and generate a random secret:

```bash
$ cp .env.example .env
$ node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open `.env` and replace `change-me-to-a-long-random-string` with the value it printed. Docker Compose reads `.env` and passes `JWT_SECRET` to the API. If it's missing, Compose stops with:

```text
required variable JWT_SECRET is missing a value: Set JWT_SECRET in .env - see .env.example
```

## 4. Read the code

### `server.js`: from routes to routers

The `/api/ping` route moved out of `server.js`. Now every API route is mounted in one line, followed by two error handlers:

```js
app.use('/api', apiRouter);   // apiRouter comes from routes/index.js

app.use(notFound);            // nothing matched: 404
app.use(errorHandler);        // something threw: decide the status code
```

Order matters. Express tries middleware and routes top to bottom, so the error handlers go **last**.

### `routes/index.js`, `routes/auth.js`, `routes/users.js`

`routes/index.js` gives each group of routes its own prefix:

```js
router.get('/ping', ...);
router.use('/auth', require('./auth'));    // → /api/auth/...
router.use('/users', require('./users'));  // → /api/users/...
```

`routes/users.js` defines the user routes. Read it like a sentence:

```js
router.param('userId', validateObjectId);

router.post('/', users.createUser);
router.get('/:userId', requireAuth, requireSelf, users.getUser);
```

- `POST /api/users` **creates** a user, which means registering. Anyone may do it.
- `GET /api/users/:userId` **reads** one user. `:userId` is a *route parameter*: for `/api/users/66ab...`, `req.params.userId` is `66ab...`. Before the controller runs, two middleware functions must pass: `requireAuth` (are you logged in?) and `requireSelf` (is this *your* account?).
- `router.param('userId', validateObjectId)` runs for any route with `:userId`. MongoDB ids are 24 hex characters; anything else gets **400 Bad Request** right away instead of a confusing database error.

Logging in is `POST /api/auth/login`. It's the one URL that names an action instead of a thing, because a login isn't really a resource. That's a common, accepted exception to REST naming.

### `models/User.js`: hashing passwords

```js
password: {
  type: String,
  required: [true, 'Password is required'],
  select: false
},
```

`select: false` means queries **never return the password field** unless they explicitly ask for it. It can't leak by accident.

```js
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});
```

A **pre-save hook** runs just before a user is written to the database. Whenever the password is new or changed, it's replaced with its bcrypt hash. Controllers never have to remember to do this.

```js
userSchema.methods.checkPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};
```

To check a login, bcrypt hashes the attempt the same way and compares the results. The original password is never needed, or recoverable.

Why bcrypt and not a plain hash? bcrypt is **deliberately slow** and adds a random **salt**, so two users with the same password get different hashes, and an attacker who steals the database must crack each password separately, slowly.

### `controllers/usersController.js`: register

```js
if (!login || !password) {
  return res.status(400).json({ error: 'login and password are required' });
}
if (await User.exists({ login: String(login) })) {
  return res.status(409).json({ error: 'A user with that login already exists' });
}

const user = await User.create({ ..., role: 'user' });

res.status(201).location(`/api/users/${user._id}`).json({ token: createToken(user), user });
```

- **400 Bad Request:** the client sent something incomplete.
- **409 Conflict:** it clashes with something that exists.
- **201 Created**, plus a `Location` header with the new user's URL: the REST way to say "made it, and here's where it lives".
- `role` is always `'user'`. The request body is ignored for it; otherwise anyone could register as an admin.
- A new user is logged in right away, so the response includes a token.

### `controllers/authController.js`: login

```js
const user = await User.findOne({ login: String(login) }).select('+password');

if (!user || !(await user.checkPassword(String(password)))) {
  return res.status(401).json({ error: 'Invalid login or password' });
}

res.status(200).json({ token: createToken(user), user });
```

- `.select('+password')` asks for the hidden password field: the one place it's needed.
- **`String(login)` matters.** Without it, someone could send `{"login": {"$ne": null}}`, and MongoDB would treat that object as a *query operator* meaning "any login that isn't null". This is called **NoSQL injection**. Forcing it to a string closes the hole.
- The same message for "no such user" and "wrong password" means attackers can't use the login form to discover which usernames exist.
- **401 Unauthorized:** "I don't know who you are."

The response's `user` never contains the password, even though this query loaded it: the model's `toJSON` setting removes it whenever a user is turned into JSON.

### `middleware/auth.js`: making and checking tokens

```js
exports.createToken = (user) =>
  jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
```

A JWT has three parts: a header, a **payload** (here `sub`, the user's id, plus an expiry time), and a **signature** made with your secret. The payload isn't encrypted — anyone can read it — but nobody can *change* it without breaking the signature.

```js
exports.requireAuth = (req, res, next) => {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

Clients send the token in a header: `Authorization: Bearer <token>`. If the signature checks out and it hasn't expired, `requireAuth` records who the user is in `req.userId` and calls **`next()`** to pass the request along. Otherwise it answers 401 and the controller never runs.

```js
exports.requireSelf = (req, res, next) => {
  if (req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'You can only access your own account' });
  }
  next();
};
```

**403 Forbidden** means "I know who you are, and you're not allowed." Compare it with 401, which means "I don't know who you are."

### `middleware/errorHandler.js`

Controllers wrap their work in `try { ... } catch (err) { next(err); }`. Calling `next` with an error skips every remaining route and lands here, where one function turns errors into responses: bad JSON becomes 400, a duplicate username becomes 409, and anything unexpected becomes 500 (and is logged). Error responses look the same everywhere: `{ "error": "..." }`.

### `config/auth.js` and `seed.js`

`config/auth.js` reads `JWT_SECRET` and refuses to start without it. Failing loudly is safer than running with no secret.

`seed.js` is another way to load the test user and cards, for a database that Compose didn't create (it creates the user through the model, so the hook hashes the password). Run it inside the container if you ever need it: `docker compose exec api npm run seed`.

## 5. Start the API

`package.json` changed, so rebuild with `-V`:

```bash
$ docker compose up --build -V
```

## 6. Try it with Bruno

The collection now has five requests. In Bruno, select the **Development** environment, then right-click the collection and choose **Run** to run them all in order:

| Request | What it checks |
|---|---|
| **Ping** | The API is up |
| **Register** | A new account is created (201), gets a token, and never shows its password |
| **Login** | `johnaedo` / `ucf123!` logs in. Its script saves `{{token}}` and `{{userId}}` for the requests after it |
| **Get My Account** | Sends the token and gets the account back (200) |
| **Missing Token** | The same route *without* a token is refused (401) |

Open **Login** and look at its **Script** tab to see how it saves the token. Then open **Get My Account** → **Auth**: it uses *Bearer Token* with `{{token}}`.

Try breaking things on purpose:

- In **Login**, change the password and send it: **401**.
- Send **Get My Account** with the Auth type set to *No Auth*: **401**.
- Send **Register**, copy the `token` from its response, and paste it into **Get My Account → Auth** in place of `{{token}}`. The URL still has `johnaedo`'s id, so the answer is **403**. Put `{{token}}` back afterwards.

Paste a token from a Login response into [jwt.io](https://jwt.io) to see its payload. Then change one character of the token and send it: **401 Invalid or expired token**.

## 7. Commit

```bash
$ git add .
$ git commit -m "Step 3: users and authentication"
$ git push
```

Check that `.env` did **not** go to GitHub: `git status` should never list it.

---

## Check your work

- [ ] Running the whole collection: **13/13 tests pass**
- [ ] In `mongosh`, `db.users.find()` shows every password as a `$2b$...` hash
- [ ] **Get My Account** without a token returns 401; with the new user's token, 403

## Troubleshooting

- **`required variable JWT_SECRET is missing`** — you haven't created `.env`, or it has no `JWT_SECRET` line. See part 3.
- **`Error: JWT_SECRET is not set`** in the API log — same cause: the API started without the secret.
- **Login as `johnaedo` returns 401** — your database was created before Step 2's `mongo-init.js` stored a hashed password. Reset it: `docker compose down -v` then `docker compose up --build -V`.
- **`Cannot find module 'bcryptjs'`** — you forgot `-V`.
- **Get My Account returns 401 even after Login** — run Login first in the same Bruno session (tokens also expire after an hour), and check the request's Auth tab is *Bearer Token* with `{{token}}`.

**Stuck?** Compare your project with `checkpoint/cards-backend/`.

**Next:** [Step 4 — Cards](../04-cards/README.md)
