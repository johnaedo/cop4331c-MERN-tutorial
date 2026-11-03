# Step 4 — Cards

**You'll end with:** the complete API: logged-in users can list, search, add, read, update, and delete their own cards, and can't touch anyone else's.
**Time:** about 60 minutes.

---

## What you'll learn

- **CRUD** — Create, Read, Update, Delete — and the HTTP method and status code REST uses for each.
- **Nested routes** for a one-to-many relationship: a user's cards live *under* the user.
- **Shallow nesting**: once something exists, it gets its own short URL.
- **Authorization** (who may do what) on top of **authentication** (who you are).
- Searching MongoDB with regular expressions, safely.

## The card routes

| Method and URL | Does | Success |
|---|---|---|
| `GET /api/users/:userId/cards?search=` | List your cards, optionally searched | **200** + array |
| `POST /api/users/:userId/cards` | Add a card to your collection | **201** + card + `Location` |
| `GET /api/cards/:id` | Read one card | **200** + card |
| `PATCH /api/cards/:id` | Change some of a card's fields | **200** + updated card |
| `DELETE /api/cards/:id` | Delete a card | **204** (no body) |

Why two URL shapes? A card is always created *in someone's collection*, so listing and creating happen at `/api/users/:userId/cards`: the URL itself shows the one-to-many relationship. But once a card exists it has its own unique id, so `/api/cards/:id` is enough to find it. Writing `/api/users/:userId/cards/:id` would only repeat information. This pattern is called **shallow nesting**.

`PATCH` versus `PUT`: `PUT` means "replace the whole thing with what I send"; `PATCH` means "change just these fields". The app only ever sends the changed fields, so it uses `PATCH`.

## 1. Copy in this step's files

No new packages this time.

```bash
$ cp -r "$TUTORIALS/04-cards/files/." "$WORKSPACE/"
```

```text
cards-backend/
├── routes/
│   ├── index.js                 (changed: adds /cards)
│   ├── users.js                 (changed: adds /:userId/cards)
│   └── cards.js                 (new: /api/cards/:id)
├── controllers/cardsController.js   (new)
└── api-tests/
    └── List My Cards, Add Card, Get Card, Update Card, Delete Card   (new)
```

## 2. Read the code

### `routes/users.js`: the nested routes

```js
router
  .route('/:userId/cards')
  .all(requireAuth, requireSelf)
  .get(cards.listCards)
  .post(cards.createCard);
```

`router.route(path)` groups every method for one URL. `.all(...)` runs the two checks before *any* method on it, so you can only list or add cards in **your own** collection.

### `routes/cards.js`: the shallow routes

```js
router.param('id', validateObjectId);
router.use(requireAuth);

router
  .route('/:id')
  .get(cards.getCard)
  .patch(cards.updateCard)
  .delete(cards.deleteCard);
```

`router.use(requireAuth)` protects every route in this file. There's no `:userId` in these URLs, so `requireSelf` can't help here; the controller checks ownership itself (below).

### `controllers/cardsController.js`

**Searching.** `buildCardQuery` always limits results to one user, and adds a search when there is one:

```js
const query = { userId };

if (search) {
  const pattern = { $regex: escapeRegex(search), $options: 'i' };
  query.$or = [
    { playerName: pattern }, { card: pattern }, { teamName: pattern }, { publisher: pattern },
    ...(Number.isNaN(searchNum) ? [] : [{ cardValue: searchNum }])
  ];
}
```

- `$regex` with `$options: 'i'` matches text anywhere in a field, ignoring case: `speedy` finds *Speedy Gonzales*.
- `$or` means "any of these fields matches". A numeric search also matches `cardValue` exactly.
- **`escapeRegex`** matters: characters like `(` or `.` mean something special in a regular expression. Without escaping, searching for `(` would crash the query, and a crafted pattern could make the database work very hard.

**Choosing which fields a client may set.** `pickCardFields` copies only the five card fields from the request body:

```js
const fields = {};
if (body.playerName !== undefined) fields.playerName = String(body.playerName).trim();
...
```

This is a **whitelist**. If the client sends `userId` (trying to move a card into someone else's collection) or any other field, it's simply ignored.

**Checking ownership.** Every single-card handler starts with `loadOwnedCard`:

```js
const card = await Card.findById(req.params.id);
if (!card) {
  res.status(404).json({ error: 'Card not found' });
  return null;
}
if (card.userId !== req.userId) {
  res.status(403).json({ error: 'You can only access your own cards' });
  return null;
}
return card;
```

`req.userId` was set by `requireAuth` from the token. So even if you guess another card's id, you get **403**.

**Creating.** `createCard` checks the input (400), refuses a second card with the same name in your collection (**409 Conflict**, matching case-insensitively), saves the card, and answers **201** with a `Location: /api/cards/<new id>` header.

**Updating.** `updateCard` loads the card, applies only the allowed fields with `card.set(fields)`, and saves it.

**Deleting.** `deleteCard` answers **204 No Content**: success, with nothing to send back.

## 3. Restart and run the collection

`package.json` didn't change, so nodemon has already restarted the API if it was running. If not:

```bash
$ docker compose up
```

In Bruno, **Run** the whole collection with the **Development** environment. The new requests run in a chain:

1. **List My Cards** searches the logged-in user's collection for `speedy`. That's the user **Register** just created, who has no cards yet, so the answer is an empty array; the test only checks that every card returned is yours.
2. **Add Card** creates a card with a unique name and saves its id as `{{cardId}}`.
3. **Get Card**, **Update Card**, and **Delete Card** use `{{cardId}}`.

Now explore on your own:

- Send **Add Card** twice: both succeed, because its script makes a new name each time. Then, in **List My Cards**, remove the `search` parameter and send it: your two cards come back.
- In **Add Card**, change the body's `playerName` to `"Bugs Bunny"` and send it twice: **201** the first time, then **409**, because you already own a card with that name.
- After **Delete Card**, send **Get Card** again: **404**.
- Want to see the 20 seeded Looney Tunes cards? In **Login**'s body, temporarily use `{{login}}` and `{{password}}` (the environment's `johnaedo` account) instead of `{{newLogin}}` and `{{newPassword}}`, send it, then send **List My Cards** without `search`. (One of Login's tests fails while you do this, since it expects the new user.) Change the body back afterwards.
- In **Update Card**, add `"userId": "000000000000000000000000"` to the body. The response's `userId` doesn't change.

## 4. Commit

```bash
$ git add .
$ git commit -m "Step 4: cards"
$ git push
```

---

## Check your work

- [ ] Running the whole collection: **23/23 tests pass**
- [ ] **List My Cards** with its Auth set to *No Auth* returns 401
- [ ] After sending **Add Card** twice, **List My Cards** without `search` returns exactly those 2 cards

## Troubleshooting

- **Every card request returns 404 `Route not found`** — `routes/index.js` is missing the `router.use('/cards', ...)` line, or you didn't copy the new `routes/users.js`.
- **List My Cards returns 403** — the `userId` in the URL isn't the logged-in user's. Run **Login** first so `{{userId}}` is set.
- **Add Card returns 409 every time** — you edited the request's body to a fixed name that already exists. Use `{{cardName}}` or another new name.

**Stuck?** Compare your project with `checkpoint/cards-backend/`.

**Next:** [Step 5 — Automated tests](../05-automated-tests/README.md)
