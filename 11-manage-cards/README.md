# Step 11 — Manage Cards

**You'll end with:** the complete app: add a card, edit any of your cards, and delete them, with the list updating instantly and clear messages for success and errors.
**Time:** about 60 minutes.

---

## What you'll learn

- **One form, two jobs:** the same form adds a new card or edits an existing one, depending on state.
- **Passing functions as props:** `CardList` draws the Edit and Delete buttons, but `CardUI` decides what they do. This is called *lifting state up*: the state lives in the parent, and children report events to it.
- **Updating arrays in state without changing them in place**, using `map`, `filter`, and the spread operator (`...`).
- **Mapping UI actions to REST:** Add → `POST`, Save changes → `PATCH`, Delete → `DELETE`.

## 1. Copy in this step's files

```bash
$ cp -r "$TUTORIALS/11-manage-cards/files/." "$WORKSPACE/"
```

```text
cards-frontend/src/components/CardUI.tsx    (changed: adds the add / edit form and delete)
```

Compare the new `CardUI.tsx` with the one from Step 10: apart from one line that now passes `onDelete` and `onEdit` to `CardList`, everything you already had is unchanged, and the new parts are added around it.

## 2. Read the code

### The form's state

```tsx
const [playerName, setPlayerName] = useState("");
const [teamName, setTeamName] = useState("");
const [cardValue, setCardValue] = useState("");
const [publisher, setPublisher] = useState("");
const [editingCard, setEditingCard] = useState<CardData | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [formFeedback, setFormFeedback] = useState<Feedback>(null);
```

`editingCard` is the switch. When it's `null`, the form adds a new card; when it holds a card, the form edits that card. The heading, button label, and icon all read from it:

```tsx
{editingCard ? "Edit Card" : "Add New Card"}
```

`cardValue` is a string because it comes from a text input; it's turned into a number only when saving.

### Passing the buttons' behavior down

```tsx
<CardList cards={cards} onDelete={handleDelete} onEdit={startEditing} />
```

`CardList` already knew how to draw Edit and Delete buttons whenever these props are given. Clicking one calls `onEdit(item)` or `onDelete(item._id)`, which runs `CardUI`'s function. `CardList` stays a pure display component; all the data handling stays in one place.

`startEditing` copies the card's values into the form's state, and `resetForm` empties it and sets `editingCard` back to `null`.

### Saving: add or update

```tsx
async function handleSave(e: FormEvent): Promise<void> {
  e.preventDefault();
  ...
  const fields = {
    playerName,
    teamName,
    cardValue: cardValue ? parseFloat(cardValue) : 0,
    publisher,
  };

  const res = editingCard
    ? await apiFetch<CardData>(`api/cards/${editingCard._id}`, { method: "PATCH", body: fields })
    : await apiFetch<CardData>(cardsRoute, { method: "POST", body: fields });
```

Editing sends `PATCH /api/cards/:id`; adding sends `POST /api/users/:userId/cards`. Both return the saved card, so the page can update without reloading the whole list:

```tsx
if (editingCard) {
  setCards((current) => current.map((c) => (c._id === res.data._id ? res.data : c)));
} else {
  setCards((current) => [...current, res.data]);
}
```

Two important habits here:

- **Never change state in place.** `cards.push(newCard)` would change the existing array, and React wouldn't notice anything changed. Instead, build a *new* array: `[...current, res.data]` copies the old cards and adds one; `.map()` returns a new array with one card swapped out.
- **Use the updater form** `setCards((current) => ...)` when the new value depends on the old one. React passes in the latest value, which avoids bugs when updates happen close together.

If the API refuses (for example **409**, *You already have a card with that name*), its message is shown in red and the form keeps what you typed.

### Deleting

```tsx
async function handleDelete(id: string): Promise<void> {
  if (!window.confirm("Are you sure you want to delete this card?")) return;

  const res = await apiFetch<null>(`api/cards/${id}`, { method: "DELETE" });
  ...
  setCards((current) => current.filter((c) => c._id !== id));
  if (editingCard?._id === id) resetForm();
}
```

`window.confirm` shows the browser's yes/no box. The API answers **204 No Content**; `apiFetch` already handles the empty body. `.filter()` returns a new array without the deleted card. And if you delete the card you were editing, the form resets.

## 3. Try it

Log in as `johnaedo` / `ucf123!`.

1. **Add** a card: fill in the form and click **Add Card**. *Card has been added* appears, the form clears, and the count goes from 20 to 21.
2. **Duplicate:** add a card named `Bugs Bunny`. The API's 409 message appears in red.
3. **Edit:** search for your new card, click its pencil icon, change the value, and click **Update Card**. The card in the list updates.
4. Start editing a card, then click **Cancel Edit**: the form goes back to *Add New Card*.
5. **Delete** your new card with the trash icon and confirm.
6. In the **Network** tab, find the `POST`, `PATCH`, and `DELETE` requests and their status codes: **201**, **200**, **204**.
7. Reload the page. Your changes are still there, because they were saved in MongoDB, not just on screen.

## 4. Commit

```bash
$ npm run lint
$ git add .
$ git commit -m "Step 11: manage cards"
$ git push
```

---

## Check your work

- [ ] Adding, editing, and deleting a card all work, and survive a reload
- [ ] Adding a duplicate name shows *You already have a card with that name*
- [ ] **Cancel Edit** returns the form to *Add New Card*
- [ ] The Network tab shows `201`, `200`, and `204` for add, edit, and delete
- [ ] `npm run lint` and `npm run build` succeed

## Troubleshooting

- **The new card doesn't appear until you reload** — the state update is missing, or it changes the array in place (`push`) instead of making a new one.
- **Edit creates a second card instead of changing the first** — `editingCard` is `null` when you save. Check that the pencil button calls `startEditing` (`onEdit={startEditing}`).
- **Delete does nothing** — your browser may be blocking `confirm` dialogs for this site; check the address bar.
- **`API Error: You can only access your own cards`** — you're logged in as a different user than the card's owner. That's the API's ownership check from Step 4 working.

**Stuck?** Compare your project with `checkpoint/cards-frontend/`.

**Next:** [Step 12 — End-to-end tests](../12-end-to-end-tests/README.md)
