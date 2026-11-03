# Step 9 — Login and Register

**You'll end with:** a working login page that talks to your API: you can register, log in, stay logged in across reloads, and log out, and the cards page is off-limits until you do.
**Time:** about 75 minutes.

---

## What you'll learn

- **State.** `useState` gives a component memory: the text in an input, whether a request is loading, an error message. Changing state makes React redraw the component.
- **Forms and events.** Inputs whose value comes from state (*controlled inputs*) and handlers like `onSubmit` and `onChange`.
- **Calling the API** with `fetch`, and wrapping it in a small helper so every request handles JSON, tokens, and errors the same way.
- **Sessions in the browser.** Saving the token in `localStorage` so a reload doesn't log you out.
- **Protected pages.** A route guard that sends logged-out visitors back to the login page.

## Before you start

The frontend now needs the backend. In another terminal, start it:

```bash
$ cd "$WORKSPACE/cards-backend"
$ docker compose up
```

## 1. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/09-login-and-register/files/." "$WORKSPACE/"
```

```text
cards-frontend/src/
├── App.tsx                        (changed: adds /cards, protected)
├── utils/
│   ├── buildPath.ts               (new: API route → full URL)
│   ├── api.ts                     (new: apiFetch, the one way to call the API)
│   └── session.ts                 (new: save / read / clear the login)
├── components/
│   ├── Login.tsx                  (new: the login and registration form)
│   └── LoggedInName.tsx           (new: "Logged In As ..." and Log Out)
└── pages/
    ├── LoginPage.tsx              (changed: shows the form)
    └── CardPage.tsx               (new: a placeholder for Step 10)
```

No new packages, so there's nothing to install. Run `npm run dev` if it isn't already running.

## 2. Read the code

### `src/utils/buildPath.ts`

```ts
export function buildPath(route: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
  ...
  return `${cleanBase}/${cleanRoute}`;
}
```

`buildPath("api/auth/login")` returns `http://localhost:5000/api/auth/login` while developing. In the production build, `VITE_API_BASE_URL` is empty, so it returns just `/api/auth/login`: "the API on this same site." This is where Step 8's `.env` files pay off.

The `??` operator matters here. `a ?? b` uses `b` only if `a` is `undefined` or `null`. The more familiar `a || b` would also replace an *empty* string, and the production build would wrongly call `localhost:5000`.

### `src/utils/session.ts`

```ts
export interface Session {
  token: string;
  id: string;
  firstName: string;
  lastName: string;
}
```

An **interface** is a TypeScript description of an object's shape. After logging in, the app saves a `Session` in **`localStorage`**, the browser's small key–value store for this site, which survives reloads and restarts. `getSession()` reads it back (or returns `null`), `saveSession()` writes it, and `clearSession()` logs out.

> Anything in `localStorage` can be read by JavaScript running on the page. That's fine for a course project; larger apps often keep tokens in special cookies that page scripts can't read.

### `src/utils/api.ts`: one way to call the API

Every request the app makes goes through `apiFetch`, so these rules live in one place:

```ts
export async function apiFetch<T>(route: string, options = {}): Promise<ApiResult<T>> {
  const session = getSession();

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (session) headers["Authorization"] = `Bearer ${session.token}`;

  const response = await fetch(buildPath(route), { method, headers, body: JSON.stringify(...) });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (response.status === 401 && session) {
    clearSession();
    window.location.href = "/";
  }

  return { ok: response.ok, status: response.status, data, error: ... };
}
```

- **The token:** if you're logged in, every request carries `Authorization: Bearer <token>`, exactly like Bruno's Bearer Token setting.
- **JSON both ways:** objects are turned into JSON for the request, and the response text is parsed back. An empty response (like a 204 after a delete) becomes `null` instead of crashing `JSON.parse`.
- **Expired logins:** if the API answers 401 while you have a saved session, the token has expired or been rejected, so the user is logged out and sent to the login page.
- **Errors:** `ok` is true for any 2xx status. Otherwise `error` holds the API's `{ "error": "..." }` message, ready to show on screen.
- **`<T>`** is a TypeScript *generic*: the caller says what shape `data` will have, as in `apiFetch<AuthResponse>(...)`.

### `src/components/Login.tsx`

The biggest file so far, but most of it is the form's layout. The logic is at the top.

**State.** Each input has its own state, plus a few for the form itself:

```tsx
const [isRegisterMode, setIsRegisterMode] = useState(false);
const [message, setMessage] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [loginName, setLoginName] = useState("");
const [loginPassword, setPassword] = useState("");
```

`useState(initialValue)` returns the current value and a function to change it. Inputs are **controlled**: their `value` comes from state, and typing calls the setter:

```tsx
<input id="loginName" value={loginName} onChange={handleSetLoginName} required ... />
```

**Logging in:**

```tsx
async function doLogin(event: FormEvent): Promise<void> {
  event.preventDefault();
  setIsLoading(true);
  ...
  const res = await apiFetch<AuthResponse>("api/auth/login", {
    method: "POST",
    body: { login: loginName, password: loginPassword },
  });

  if (!res.ok) {
    setMessage(res.error ?? "Login failed");
  } else {
    startSession(res.data);
    window.location.href = "/cards";
  }
  ...
}
```

`event.preventDefault()` stops the browser's old-fashioned form submission, which would reload the page. Then: send the request, show the API's error message if it failed, or save the session and go to `/cards`. `startSession` turns the API's `{ token, user }` into a `Session` and saves it.

**Registering** is the same pattern with `POST api/users`. Since the API returns a token when you register, the new user is logged in straight away.

**Conditional rendering.** One component shows two forms:

```tsx
{!isRegisterMode ? (
  <form onSubmit={doLogin}> ... </form>
) : (
  <form onSubmit={doRegister}> ... </form>
)}
```

The tab buttons just flip `isRegisterMode`, and React swaps the forms. The same idea shows the spinner while `isLoading` is true, and hides the error box (`className="d-none"`) when there's no message.

### `src/App.tsx`: protecting `/cards`

```tsx
function RequireLogin({ children }: { children: ReactNode }) {
  return getSession() ? children : <Navigate to="/" replace />;
}

<Route path="/cards" element={<RequireLogin><CardPage /></RequireLogin>} />
```

`RequireLogin` is a component that wraps a page: logged in, you see the page; not logged in, you're redirected. It only decides what the *browser* shows. The real protection is on the server, which refuses requests without a valid token, so even someone who bypasses this check gets nothing.

### `src/components/LoggedInName.tsx`

Shows the logged-in user's name and a **Log Out** button, which calls `clearSession()` and goes back to `/`.

## 3. Try it

With the backend and `npm run dev` both running, open <http://localhost:8000>.

1. Log in with a wrong password: you see the API's message, *Invalid login or password*.
2. Open the developer tools (**F12**) → **Network** tab, and tick **Preserve log** so the list survives the page change. Now log in as `johnaedo` / `ucf123!`. Click the `login` request in the list: **Payload** shows what the form sent, and **Response** shows the token and user that came back. You land on `/cards` and see *Logged In As John Aedo*.
3. Reload the page: you stay logged in.
4. In the developer tools, open **Application** (Chrome) or **Storage** (Firefox) → **Local Storage** → `http://localhost:8000`. The `user_data` key holds your token, id, and name.
5. Click **Log Out**: `user_data` disappears and you're back at the login page.
6. Visit <http://localhost:8000/cards> while logged out: you're sent to `/`.
7. Click **Register** and create an account. You're logged in as the new user.

## 4. Commit

```bash
$ cd "$WORKSPACE/cards-frontend"
$ npm run lint
$ git add .
$ git commit -m "Step 9: login and register"
$ git push
```

---

## Check your work

- [ ] Logging in as `johnaedo` / `ucf123!` shows *Logged In As John Aedo*
- [ ] A wrong password shows *Invalid login or password*
- [ ] Reloading `/cards` keeps you logged in; **Log Out** logs you out
- [ ] `/cards` redirects to `/` when logged out
- [ ] Registering a new account logs you in as that user
- [ ] `npm run build` and `npm run lint` succeed

## Troubleshooting

- **`TypeError: Failed to fetch`** on login — the frontend can't reach the API. Is `docker compose up` running in `cards-backend`? Does <http://localhost:5000/api/ping> work in the browser? Is `.env.development` pointing at `http://localhost:5000`? (Restart `npm run dev` after editing a `.env` file.)
- **A red *CORS* error in the console** — the backend's `app.use(cors())` line is missing or comes after the routes in `server.js`.
- **Login works but `/cards` sends you back to `/`** — the session wasn't saved. Check `user_data` in Local Storage, and that `startSession` is called before the redirect.
- **The page doesn't change after you edit a file** — check the terminal running `npm run dev` for a compile error.

**Stuck?** Compare your project with `checkpoint/cards-frontend/`.

**Next:** [Step 10 — Card list](../10-card-list/README.md)
