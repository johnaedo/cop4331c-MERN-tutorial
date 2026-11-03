# Step 10 — Card List

**You'll end with:** a cards page that loads your collection as soon as it opens, searches it, and shows the results as a grid of cards, a few per page.
**Time:** about 60 minutes.

---

## What you'll learn

- **`useEffect`** runs code *after* React draws a component: the place to start loading data when a page opens.
- **Props** pass data from a parent component to a child: `CardUI` fetches the cards and hands them to `CardList` to display.
- **Rendering lists** with `.map()`, and why each item needs a `key`.
- **Derived values:** the current page of cards is *calculated* from state on every render, not stored separately.

## 1. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/10-card-list/files/." "$WORKSPACE/"
```

```text
cards-frontend/src/
├── components/
│   ├── CardUI.tsx       (new: loads and searches your cards)
│   └── CardList.tsx     (new: shows cards as a paginated grid)
└── pages/CardPage.tsx   (changed: shows CardUI)
```

Make sure the backend (`docker compose up` in `cards-backend`) and `npm run dev` are both running.

## 2. Read the code

### `CardUI.tsx`: loading the cards

At the top of the file, outside the component, is a plain async function:

```tsx
type CardsResult = { cards: CardData[]; feedback: string };

async function fetchCards(cardsRoute: string, term = ""): Promise<CardsResult> {
  try {
    const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : "";
    const res = await apiFetch<CardData[]>(`${cardsRoute}${query}`);

    return res.ok
      ? { cards: res.data, feedback: `${res.data.length} card(s) found` }
      : { cards: [], feedback: "API Error: " + res.error };
  } catch (error: unknown) {
    return { cards: [], feedback: (error as Error).toString() };
  }
}
```

It asks the API for a user's cards and returns them along with a message to show (*20 card(s) found*, or the error). It doesn't touch React state at all, which keeps it easy to reuse and test. `encodeURIComponent` makes search text safe to put in a URL (spaces become `%20`, and so on).

Inside the component, the route comes from the session:

```tsx
const [session] = useState(() => getSession()!);
const cardsRoute = `api/users/${session.id}/cards`;
```

The session is read **once**, when the component first appears. If a request later comes back 401, `apiFetch` clears the session while this page is still on screen, and any redraw after that must not depend on it. (The `!` tells TypeScript "this won't be null": `RequireLogin` already guarantees that.)

### `useEffect`: load when the page opens

```tsx
const [isSearching, setIsSearching] = useState(true);

useEffect(() => {
  fetchCards(cardsRoute).then((result) => {
    setCards(result.cards);
    setSearchFeedback(result.feedback);
    setIsSearching(false);
  });
}, [cardsRoute]);
```

React calls the effect *after* drawing the page. The second argument, `[cardsRoute]`, is the **dependency list**: React runs the effect again only when one of these values changes. `cardsRoute` never changes on this page, so the cards load exactly once.

Notice the effect *starts* the request and only updates state in `.then(...)`, when the answer arrives. Setting state immediately inside an effect would make React draw the page twice for no reason, and the linter flags it. That's also why `isSearching` starts as `true`: the page is loading from the moment it appears.

### Searching

```tsx
async function handleSearch(e: FormEvent): Promise<void> {
  e.preventDefault();
  setIsSearching(true);
  showCards(await fetchCards(cardsRoute, search));
}
```

Same request, plus the search text. `showCards` puts the result into state. While `isSearching` is true, the button is disabled and shows a spinner.

### `CardList.tsx`: props and lists

`CardUI` hands the cards down as a **prop**:

```tsx
<CardList cards={cards} />
```

`CardList` declares what props it accepts with an interface:

```tsx
interface CardListProps {
  cards: CardData[];
  initialItemsPerPage?: number;
  onDelete?: (id: string) => void;
  onEdit?: (card: CardData) => void;
}
```

The `?` marks a prop as optional. `onDelete` and `onEdit` are *functions* the parent can pass in; you'll use them in Step 11. For now there are no buttons, because `CardUI` doesn't pass them.

**Pagination is derived, not stored.** `CardList` keeps only two pieces of state, the current page and how many per page, and calculates everything else on each render:

```tsx
const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
const startIndex = (validCurrentPage - 1) * itemsPerPage;
const currentCards = cards.slice(startIndex, startIndex + itemsPerPage);
```

**Rendering a list** uses `.map()`, turning each card object into JSX:

```tsx
{currentCards.map((item, index) => (
  <div key={item._id || `${startIndex + index}`} className="col">
    ...
    {item.teamName && <span className="badge ...">{item.teamName}</span>}
  </div>
))}
```

The **`key`** lets React tell the items apart when the list changes, so it can update just what changed. Use something unique and stable, like the database id. `{item.teamName && ...}` shows the badge only when there is a team name.

## 3. Try it

Log in as `johnaedo` / `ucf123!`.

1. The page opens with *20 card(s) found* and the first four cards.
2. Use the page buttons and the **Per page** menu.
3. Search for `tune squad`: Bugs Bunny and Lola Bunny. Search for `topps`, then `15000` (a card value).
4. Clear the search box and search again to see everything.
5. Open the **Network** tab: each search is one `GET .../cards?search=...` request. Click one, then look at **Headers → Request Headers** to find `Authorization: Bearer ...`.
6. Log out and register a new user: their collection is empty (*0 card(s) found*). Each user only sees their own cards, because the API enforces it.

## 4. Commit

```bash
$ npm run lint
$ git add .
$ git commit -m "Step 10: card list"
$ git push
```

---

## Check your work

- [ ] Logging in as `johnaedo` shows *20 card(s) found* without clicking anything
- [ ] Searching `tune squad` shows exactly 2 cards
- [ ] Pagination: page 2 shows *Showing 5–8 of 20 card(s)*
- [ ] A new user sees *0 card(s) found*
- [ ] `npm run lint` and `npm run build` succeed

## Troubleshooting

- **The list is empty but there's no error** — you're logged in as a user with no cards. Log in as `johnaedo`.
- **`API Error: Authentication required`** — the request has no token. Make sure the file uses `apiFetch`, not `fetch` directly.
- **You're sent back to the login page** — the API answered 401, so your token expired (after an hour) or the backend's `JWT_SECRET` changed since you logged in. Log in again.
- **Lint error: *Calling setState synchronously within an effect*** — something calls a state setter directly inside `useEffect`. Set state only inside `.then(...)`, as shown above.

**Stuck?** Compare your project with `checkpoint/cards-frontend/`.

**Next:** [Step 11 — Manage cards](../11-manage-cards/README.md)
