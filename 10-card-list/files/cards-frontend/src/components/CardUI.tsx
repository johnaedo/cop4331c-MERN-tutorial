import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { apiFetch } from "../utils/api";
import { getSession } from "../utils/session";
import CardList, { type CardData } from "./CardList";

type CardsResult = { cards: CardData[]; feedback: string };

// Asks the API for a user's cards, optionally filtered by a search term.
// Returns the cards plus a message for the page; it never throws.
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

function CardUI() {
  // RequireLogin in App.tsx guarantees there is a session on this page.
  // Read it once: if the API rejects the token, the session is cleared while
  // the page is still on screen, and later renders must not depend on it.
  const [session] = useState(() => getSession()!);
  const cardsRoute = `api/users/${session.id}/cards`;

  const [cards, setCards] = useState<CardData[]>([]);
  const [search, setSearch] = useState("");
  const [searchFeedback, setSearchFeedback] = useState("");
  // True while cards are loading, starting with the first load below
  const [isSearching, setIsSearching] = useState(true);

  // Puts a fetchCards() result on the page
  function showCards(result: CardsResult): void {
    setCards(result.cards);
    setSearchFeedback(result.feedback);
    setIsSearching(false);
  }

  // Show the user's whole collection when the page first opens. The effect
  // only starts the request; the page updates when the answer arrives.
  useEffect(() => {
    fetchCards(cardsRoute).then((result) => {
      setCards(result.cards);
      setSearchFeedback(result.feedback);
      setIsSearching(false);
    });
  }, [cardsRoute]);

  async function handleSearch(e: FormEvent): Promise<void> {
    e.preventDefault();
    setIsSearching(true);
    showCards(await fetchCards(cardsRoute, search));
  }

  return (
    <main id="cardUIDiv" className="w-100">
      <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5 bg-white mb-4">
        <div className="d-flex align-items-center gap-3 mb-4 border-bottom pb-3">
          <div className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: "52px", height: "52px" }}>
            <i className="bi bi-credit-card-2-front-fill fs-3" aria-hidden="true"></i>
          </div>
          <div className="ms-2">
            <h1 className="h3 fw-bold text-body-emphasis mb-1">Welcome {session.firstName} {session.lastName}</h1>
            <p className="text-secondary small mb-0">Manage and search your collection of cards efficiently.</p>
          </div>
        </div>

        <div className="row g-4">
          {/* Search and results */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 border-0 bg-light-subtle shadow-sm rounded-3 p-4">
              <h2 className="h5 fw-bold text-body-emphasis mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-search text-primary" aria-hidden="true"></i>
                Search Cards
              </h2>
              <form onSubmit={handleSearch}>
                <div className="mb-3">
                  <label htmlFor="searchText" className="form-label fw-semibold">Search Keyword</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-search text-secondary" aria-hidden="true"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      id="searchText"
                      placeholder="Search player, team, publisher, or value"
                      value={search}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    />
                    <button type="submit" id="searchCardButton" className="btn btn-primary px-3 fw-semibold d-flex align-items-center gap-2" disabled={isSearching}>
                      {isSearching
                        ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        : <i className="bi bi-search" aria-hidden="true"></i>}
                      <span>Search Card</span>
                    </button>
                  </div>
                </div>
              </form>
              <div className="mt-3">
                <span
                  id="cardSearchResult"
                  className={searchFeedback ? "badge bg-primary-subtle text-primary-emphasis fw-semibold p-2 d-inline-block mb-3 fs-6" : "d-none"}
                  role={searchFeedback ? "status" : undefined}
                  aria-live="polite"
                >
                  {searchFeedback}
                </span>
                <CardList cards={cards} />
              </div>
            </div>
          </div>

          {/* The add / edit form arrives in Step 11 */}
        </div>
      </div>
    </main>
  );
}

export default CardUI;
