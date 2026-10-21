# Step 2 — MongoDB

**You'll end with:** MongoDB running in Docker next to your API, filled with a test user and 20 cards, and Mongoose models that describe your data.
**Time:** about 45 minutes.

---

## What you'll learn

- **MongoDB** is a *document database*. Instead of tables and rows, it stores **collections** of **documents**, which look like JSON objects. This app has two collections: `users` and `cards`.
- **Mongoose** is a library that lets your Node code talk to MongoDB. You describe each kind of document with a **schema** (its fields and their types), and Mongoose gives you a **model** with methods like `find()` and `create()`.
- **Relationships:** each card belongs to exactly one user, and a user can own many cards. That's a **one-to-many** relationship. MongoDB doesn't enforce it for you; each card simply stores its owner's id in a `userId` field, and your API code will check it.
- **Docker Compose** can run several containers that talk to each other by name. Your API reaches the database at the address `mongodb`, the name of its Compose service.

## 1. Install Mongoose

```bash
$ cd "$WORKSPACE/cards-backend"
$ npm install mongoose
```

## 2. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/02-mongodb/files/." "$WORKSPACE/"
```

New and changed files:

```text
cards-backend/
├── package.json          (changed: mongoose added)
├── server.js             (changed: connects to MongoDB)
├── docker-compose.yml    (changed: adds the mongodb service)
├── .env.example          (changed: adds MONGODB_URI)
├── mongo-init.js         (new: seed data)
└── models/
    ├── Card.js
    ├── User.js
    └── index.js
```

### `models/Card.js` and `models/User.js`

A schema lists a document's fields:

```js
const cardSchema = new mongoose.Schema(
  {
    playerName: { type: String, trim: true },
    teamName:   { type: String, default: '', trim: true },
    cardValue:  { type: Number, default: 0 },
    publisher:  { type: String, default: '', trim: true },
    card:       { type: String, trim: true },
    userId:     { type: String, required: [true, 'userId is required'], trim: true }
  },
  { collection: 'cards', versionKey: false }
);

module.exports = mongoose.model('Card', cardSchema);
```

- `type` is the kind of value; Mongoose converts or rejects anything else.
- `default` fills in a value when one isn't given; `trim` strips spaces from the ends.
- `required` makes saving fail with your message if the field is missing.
- `userId` is the link to the card's owner: the one side of the one-to-many relationship.
- There are two kinds of card: a *player card* (`playerName`, `teamName`, `cardValue`, `publisher`) and a *simple card* that only has a `card` name.

`User.js` is the same idea, with `login` marked `unique: true` so two users can't share a username. In Step 3 you'll add password hashing to it.

`models/index.js` just gathers both models, so other files can write `const { User, Card } = require('./models');`.

### `server.js`

The new part connects to the database when the server starts:

```js
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/CardsDB';
mongoose
  .connect(url)
  .then(() => console.log('MongoDB connected successfully via Mongoose'))
  .catch((err) => console.error('MongoDB connection error:', err));
```

The connection string says *which server* (`mongodb` on port `27017`) and *which database* (`CardsDB`). It comes from an environment variable, so the same code can use a different database on your server or in tests.

### `docker-compose.yml`

A second service now runs the official MongoDB image:

```yaml
  mongodb:
    image: docker.io/mongo:7.0
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongo_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
```

- **`mongo_data:/data/db`** stores the database in a *named volume*, so your data survives when containers stop or are rebuilt.
- **`127.0.0.1:27017:27017`** lets tools on *your* computer reach the database, but nobody else. Without `127.0.0.1`, on a server Docker would publish an unprotected database to the entire internet.
- **`healthcheck`** asks MongoDB "are you ready?" every 10 seconds. The `api` service now has `depends_on: mongodb: condition: service_healthy`, so the API waits until the database is actually ready.
- The `api` service also gets `MONGODB_URI=mongodb://mongodb:27017/CardsDB`. Inside Compose, the host name `mongodb` means "the mongodb container".

### `mongo-init.js`

Any script mounted into `/docker-entrypoint-initdb.d/` runs **once, the very first time** MongoDB starts with an empty volume. This one creates the `johnaedo` user and gives them 20 Looney Tunes cards.

Look at the user's `password` field: it isn't `ucf123!` but a scrambled string starting with `$2b$10$`. That's a **bcrypt hash** of the password. You'll learn why passwords are stored this way in Step 3.

## 3. Start both containers

Because `package.json` changed, rebuild:

```bash
$ docker compose up --build -V
```

`-V` (short for `--renew-anon-volumes`) throws away the container's old `node_modules` so the new package (mongoose) is installed. **Use `--build -V` every time `package.json` changes.**

Watch the output. You'll see MongoDB start, the health check pass, and then the API:

```text
mern_backend  | Server running on port 5000
mern_backend  | MongoDB connected successfully via Mongoose
```

## 4. Look at the data

Open a second terminal and run the Mongo shell *inside* the database container:

```bash
$ cd "$WORKSPACE/cards-backend"
$ docker compose exec mongodb mongosh CardsDB
CardsDB> db.cards.countDocuments()
20
CardsDB> db.cards.findOne({ playerName: "Bugs Bunny" })
CardsDB> db.users.find()
CardsDB> exit
```

Notice that each card's `userId` matches the user's `_id`. Every document gets an `_id` automatically.

> **Optional:** install [MongoDB Compass](https://www.mongodb.com/products/compass) and connect to `mongodb://localhost:27017` to browse the data visually.

## 5. Commit

```bash
$ git add .
$ git commit -m "Step 2: MongoDB"
$ git push
```

---

## Check your work

- [ ] The API log says `MongoDB connected successfully via Mongoose`
- [ ] `db.cards.countDocuments()` returns **20**
- [ ] The Bruno **Ping** request still passes

## Troubleshooting

- **`countDocuments()` returns 0, or the user is missing.** The seed script only runs on an *empty* database. If you started MongoDB before `mongo-init.js` existed, the volume already holds an empty database. Delete it and start over (this erases all data):

  ```bash
  $ docker compose down -v
  $ docker compose up --build -V
  ```

- **`Cannot find module 'mongoose'`** — you started without `-V`, so the container kept its old `node_modules`. Run `docker compose up --build -V`.
- **`MongoDB connection error ... ECONNREFUSED`** — you ran `npm run dev` on your computer instead of in Docker. The address `mongodb` only exists inside Compose; use `docker compose up`.
- **Port 27017 already in use** — another MongoDB is running on your computer. Stop it, or change the left-hand port in Compose (for example `"127.0.0.1:27018:27017"`).

**Stuck?** Compare your project with `checkpoint/cards-backend/`.

**Next:** [Step 3 — Users and authentication](../03-users-and-auth/README.md)
