# Step 12 — End-to-End Tests

**You'll end with:** 37 Cypress tests that open your app in a real browser and click through it like a user: logging in, searching, adding, editing, deleting, and handling errors.
**Time:** about 60 minutes.

---

## What you'll learn

In Step 5 you tested the API by itself. **End-to-end tests** test the app from the user's side: a real browser loads your pages, types into inputs, clicks buttons, and checks what appears on screen.

- **Cypress** runs those tests. Commands like `cy.get("#loginName").type("johnaedo")` find an element and act on it, and **assertions** like `.should("be.visible")` check the result. Cypress *retries* assertions for a few seconds, so tests don't break just because the page took a moment to update.
- **Mocking the API.** `cy.intercept(...)` catches the app's requests and answers them with fake data. These tests check the *frontend*: they don't need the backend running, they can't be broken by changes in the database, and they can easily simulate rare situations like a server error, a slow network, or an expired token.
- **Fixtures** are files of fake data (`cypress/fixtures/*.json`) shared by many tests.
- **Custom commands** like `cy.loginByUI(...)` wrap common steps so tests read like instructions.

## 1. Copy in this step's files and install Cypress

```bash
$ cd "$WORKSPACE/cards-frontend"
$ cp -r "$TUTORIALS/12-end-to-end-tests/files/." "$WORKSPACE/"
$ npm install
```

```text
cards-frontend/
├── package.json            (changed: cypress, and the e2e scripts)
├── tsconfig.json           (changed: includes the Cypress TypeScript settings)
├── eslint.config.js        (changed: two rules relaxed for test files)
├── cypress.config.ts       (new)
└── cypress/
    ├── e2e/                the six test files
    ├── fixtures/           fake users and cards
    ├── support/commands.ts custom commands
    ├── support/e2e.ts      loads the commands before every test file
    └── tsconfig.json       TypeScript settings for the tests
```

`npm install` also downloads the Cypress app itself (a few hundred MB), so the first install takes a while.

**On Linux or WSL**, Cypress needs some system libraries. On Ubuntu 24.04:

```bash
$ sudo apt-get install -y libgtk2.0-0t64 libgtk-3-0t64 libgbm-dev libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 xauth xvfb
```

(For other versions, see the [Cypress Linux prerequisites](https://docs.cypress.io/app/get-started/install-cypress#Linux-Prerequisites).)

## 2. Run the tests

Cypress tests the running app, so start the dev server in one terminal:

```bash
$ npm run dev
```

and run the tests in another:

```bash
$ cd "$WORKSPACE/cards-frontend"
$ npm run e2e
```

That runs every test in a hidden browser and prints a summary. The backend does **not** need to be running: every API call is mocked.

To *watch* the tests run, use the interactive runner instead:

```bash
$ npm run e2e:open
```

Choose **E2E Testing**, pick a browser, then click a test file. You can see each step and hover over it to see what the page looked like at that moment. (On WSL this needs Windows 11, which can show Linux windows.)

## 3. Read the tests

### `cypress.config.ts`

```ts
e2e: {
  baseUrl: "http://localhost:8000",
  specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
  ...
}
```

`baseUrl` is where the app runs, so tests can write `cy.visit("/cards")`. Test files end in `.cy.ts`.

### A test, step by step

From `cypress/e2e/01_authentication.cy.ts` (slightly simplified: the real test reads the username and password from `fixtures/users.json`):

```ts
it("should show an error message when login credentials are invalid", () => {
  cy.intercept("POST", "**/api/auth/login", {
    statusCode: 401,
    body: { error: "Invalid login or password" },
  }).as("loginFailed");

  cy.loginByUI("nonexistentuser", "wrongpassword123");
  cy.wait("@loginFailed");

  cy.get("#loginResult")
    .should("be.visible")
    .and("contain.text", "Invalid login or password");
  cy.url().should("not.include", "/cards");
});
```

1. **`cy.intercept`** says: when the app sends `POST` to any URL ending in `/api/auth/login`, don't let it reach a server; answer **401** with this body. `.as("loginFailed")` names it.
2. **`cy.loginByUI`** is a custom command (in `support/commands.ts`) that types into the two inputs and clicks the button.
3. **`cy.wait("@loginFailed")`** waits until the app has actually sent that request.
4. The assertions check that the error appears and that the app didn't navigate away.

This is why the components use stable **`id`** attributes like `#loginName` and `#cardAddResult`: tests find elements by id, so changing the styling or text layout doesn't break them.

### Checking what the app *sends*

Mocks also let you inspect the request the app made. From `03_card_management.cy.ts`:

```ts
cy.wait("@addCardRequest").then((interception) => {
  expect(interception.request.headers.authorization).to.eq("Bearer test-token");
  expect(interception.request.body).to.deep.equal(data.newCard);
});
```

This proves the app sends the token and exactly the card fields, no more.

### Starting logged in

Most tests skip the login form by putting a session straight into `localStorage`:

```ts
cy.setSession({ id: "60c72b2f9b1d8b2bad000001", firstName: "John", lastName: "Aedo" });
cy.visit("/cards");
```

`setSession` (in `support/commands.ts`) writes the same `user_data` value your login code saves, with a fake token. That's fine here, because the API is mocked too.

### What the six files cover

| File | Tests |
|---|---|
| `01_authentication` | the login page, a failed and a successful login, registration, a duplicate username |
| `02_navigation_and_session` | the protected route, staying logged in, sending the token, **logging out automatically on a 401** |
| `03_card_management` | add (and the exact request sent), a duplicate card, delete, edit, cancel edit |
| `04_card_search_and_pagination` | loading on open, search, pagination, empty results |
| `05_responsive_and_accessibility` | phone, tablet, and laptop sizes; landmarks, labels, live regions; submitting with Enter |
| `06_api_mocking_and_error_handling` | a server error, a network failure, loading spinners |

### `eslint.config.js`

Chai assertions such as `expect(x).to.be.null` look like statements that do nothing, and Cypress's command types are declared with a TypeScript `namespace`. The new block switches those two lint rules off for files in `cypress/` only.

## 4. Commit

```bash
$ npm run lint
$ git add .
$ git commit -m "Step 12: end-to-end tests"
$ git push
```

---

## Check your work

- [ ] `npm run e2e` reports **37 passing** tests across 6 files
- [ ] In `npm run e2e:open`, you can watch a test log in and add a card
- [ ] Stop the backend: the tests still pass (they don't use it)
- [ ] `npm run lint` succeeds

Try breaking something to see a test catch it: in `src/components/CardUI.tsx`, change the success text *Card has been added* to something else. Run `npm run e2e` and see which test fails and why. Then change it back.

## Troubleshooting

- **`Cypress verification timed out`** or **`Cypress failed to start`** on Linux/WSL — missing system libraries. Install the packages listed in part 1.
- **`cy.visit() failed trying to load: http://localhost:8000/`** — the dev server isn't running. Start `npm run dev` first.
- **`The cypress npm package is installed, but the Cypress binary is missing`** — run `npx cypress install`.
- **A test fails only sometimes** — open it in `npm run e2e:open` and look at the step where it failed. Usually an assertion ran before the app finished; make sure the test waits for the request with `cy.wait("@alias")` first.

**Stuck?** Compare your project with `checkpoint/cards-frontend/`.

**Next:** [Step 13 — Deploy everything](../13-deploy-everything/README.md)
