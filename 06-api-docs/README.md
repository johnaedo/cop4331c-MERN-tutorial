# Step 6 — API Documentation

**You'll end with:** interactive documentation for every endpoint at `http://localhost:5000/api/docs`, where you can log in and try the API from your browser.
**Time:** about 30 minutes.

---

## What you'll learn

Whoever builds the frontend (you, in Step 8) needs to know every URL, what to send, and what comes back. **OpenAPI** is the standard format for writing that down: a YAML file that describes each endpoint. **Swagger UI** turns that file into a web page where you can read the docs and send real requests.

The documentation is just a file in your project, so it's versioned with the code and can be checked by tools. But nothing forces it to match the code, so when you change an endpoint, update `openapi.yaml` too.

## 1. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/06-api-docs/files/." "$WORKSPACE/"
```

```text
cards-backend/
├── openapi.yaml         (new: the API description)
├── routes/docs.js       (new: serves the file and the Swagger UI page)
├── routes/index.js      (changed: mounts /api/docs)
└── server.js            (changed: /openapi.yaml shortcut)
```

## 2. Read the code

### `openapi.yaml`

The file has three main parts.

**`info` and `servers`** name the API and where it runs.

**`paths`** lists every URL and method. For example:

```yaml
  /api/users/{userId}/cards:
    get:
      tags: [Cards]
      summary: List your cards
      security:
        - bearerAuth: []
      parameters:
        - name: search
          in: query
      responses:
        '200':
          description: The user's cards
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Card'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

Read it as: "`GET /api/users/{userId}/cards` needs a bearer token, takes an optional `search` query parameter, and answers 200 with an array of Cards, or 401."

**`components`** holds pieces used in many places, referenced with `$ref`:

- `schemas` — the shapes of request and response bodies (`Card`, `User`, `AuthResponse`, `Error`, ...)
- `responses` — the standard error answers (`Unauthorized`, `Forbidden`, `NotFound`, ...)
- `securitySchemes` — `bearerAuth`, which tells Swagger UI to show an **Authorize** button for tokens

Writing each shape once and referencing it keeps the file consistent and much shorter.

### `routes/docs.js`

Two routes:

- `GET /api/docs/openapi.yaml` sends the raw file.
- `GET /api/docs` sends a small HTML page that loads Swagger UI from a CDN and points it at that file.

`server.js` also redirects `/openapi.yaml` to `/api/docs/openapi.yaml`, because many tools look for the spec there.

## 3. Use the docs

With the API running (`docker compose up`), open <http://localhost:5000/api/docs>.

1. Expand **Auth → POST /api/auth/login**, click **Try it out**, keep the example body (`johnaedo` / `ucf123!`), and click **Execute**. Copy the `token` value from the response, without the quotes.
2. Click **Authorize** at the top, paste the token, and click **Authorize**, then **Close**.
3. Expand **Cards → GET /api/users/{userId}/cards**, click **Try it out**, enter `johnaedo`'s `_id` (also in the login response) as the `userId`, and **Execute**. You get the 20 cards.

Notice that every endpoint lists its possible error responses too. That's the information you'll need when the frontend has to show helpful messages.

## 4. Commit

```bash
$ git add .
$ git commit -m "Step 6: API documentation"
$ git push
```

---

## Check your work

- [ ] <http://localhost:5000/api/docs> shows the documentation with four groups: Health, Auth, Users, Cards
- [ ] After **Authorize**, listing `johnaedo`'s cards from the docs page returns 20 cards
- [ ] <http://localhost:5000/openapi.yaml> shows the raw YAML
- [ ] `npm test` still shows 27 passed

## Troubleshooting

- **The docs page is blank** — Swagger UI loads from `unpkg.com`, so you need an internet connection. Open the browser's developer tools (F12) → Console for details.
- **"Failed to load API definition"** — `openapi.yaml` has a YAML error (usually indentation). Paste it into [editor.swagger.io](https://editor.swagger.io) to find the line.
- **Requests from the docs page return 401** — the token expired (after an hour) or wasn't pasted. Log in again and re-authorize.

**Stuck?** Compare your project with `checkpoint/cards-backend/`.

**Next:** [Step 7 — Deploy the backend](../07-deploy-backend/README.md)
