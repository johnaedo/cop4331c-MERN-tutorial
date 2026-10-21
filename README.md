# Build a MERN App, Step by Step

In these tutorials you build **Cards**, a full-stack web app for keeping a collection of trading cards, one working piece at a time. By the end you will have:

- a **REST API** built with **Node.js**, **Express**, and **MongoDB**, with password hashing and login tokens
- a **React** frontend built with **Vite**, **TypeScript**, and **Bootstrap**
- automated tests for both halves
- both halves running on your own **DigitalOcean droplet**, with the frontend redeploying itself every time you push to GitHub

Every step ends with something that runs. If you get stuck, every step also includes the complete, working project as it should look when you finish that step.

---

## How the app fits together

```text
 Browser                         Your droplet (or your computer)
┌──────────────────────┐        ┌────────────────────────────────────────────┐
│ React app            │  HTTP  │ Express API (Node.js)       MongoDB        │
│ (cards-frontend)     │ ─────► │ (cards-backend)       ────► (database)     │
│                      │  JSON  │                                            │
│ login form,          │ ◄───── │ /api/auth/login        users collection    │
│ card list, search,   │        │ /api/users/:id/cards   cards collection    │
│ add / edit / delete  │        │ /api/cards/:id                             │
└──────────────────────┘        └────────────────────────────────────────────┘
        served by nginx            run with Docker Compose
```

- **M**ongoDB stores the data: users and the cards each user owns.
- **E**xpress, running on **N**ode.js, is the API. It checks who you are and reads and writes the database.
- **R**eact draws the pages in the browser and talks to the API with `fetch`.

The two halves are separate projects. The frontend never touches the database; it only asks the API.

## The steps

| Step | You build | You end with |
|---|---|---|
| [0. Setup](00-setup/README.md) | Your tools | Node, Git, Docker, VS Code, and Bruno installed |
| [1. Hello Express](01-hello-express/README.md) | A minimal API | `/api/ping` answering in Docker, checked with Bruno |
| [2. MongoDB](02-mongodb/README.md) | The database | MongoDB in Docker, seeded with 20 cards; data models |
| [3. Users and authentication](03-users-and-auth/README.md) | Accounts and login | Register and log in; hashed passwords; protected routes |

Steps 1–7 build the backend; steps 8–13 build the frontend. Do them in order: each step starts where the previous one ended.

## How each step works

Every step folder looks like this:

```text
03-users-and-auth/
├── README.md        ← the instructions: read this first
├── files/           ← only the files this step adds or changes
│   └── cards-backend/
│       ├── controllers/authController.js
│       └── ...
└── checkpoint/      ← the complete project at the END of this step
    └── cards-backend/
        └── ...
```

- **`files/`** is what you copy into your project during the step. The README walks through each file and explains the parts that matter. Copying is fast; *reading* is where the learning happens, so don't skip the explanations.
- **`checkpoint/`** is the answer key. If something isn't working, compare your project with it. You can even copy a whole checkpoint to catch up, but you'll learn more by finding the difference yourself.

Every README ends with **Check your work**. Don't move on until those checks pass.

## Your workspace

You'll keep both projects side by side in one folder, each in its own Git repository:

```text
mern-cards/
├── cards-backend/     ← Steps 1–7 (its own Git repository)
└── cards-frontend/    ← Steps 8–13 (its own Git repository)
```

The `files/` folders mirror that layout, so one command copies a whole step into the right places. In [Step 0](00-setup/README.md) you'll set two shell variables that make this easy:

```bash
cp -r "$TUTORIALS/03-users-and-auth/files/." "$WORKSPACE/"
```

That copies `files/cards-backend/...` into `mern-cards/cards-backend/...`, replacing any older version of the same files.

## Conventions used in these tutorials

- Commands are for a **bash** terminal: Terminal on macOS, any shell on Linux, and **WSL** (Ubuntu) on Windows. See Step 0 for Windows setup.
- `$` is not part of a command; it just marks the start of a line you type. Lines without it are output.
- When a step says *"replace"* a file, the new version contains everything the old one did plus the new parts.
- The seeded test account is **`johnaedo`** with password **`ucf123!`**. It owns 20 Looney Tunes cards.

## For instructors

The `checkpoint/` folders are generated from the `files/` folders. After changing anything in a `files/` folder, rebuild them from the repository root:

```bash
python tutorials/_tools/build_checkpoints.py
```

To confirm the last checkpoint still matches the finished backend and frontend repositories:

```bash
python tutorials/_tools/build_checkpoints.py --compare . ../cop4331c-mern-frontend
```

Two files differ on purpose: `api-tests/environments/Production.yml` and `.env.production` use a placeholder server address that students replace with their own.
