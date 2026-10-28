import type { CrisisRecord } from "../macro/state";
import { councilState } from "../game/crisis-rules";
import { esc, handView, revealView, standing } from "./view";

// The council meeting during play. The save's crisis records decide what it shows:
// the hand while the latest crisis has no answer, then the outcome and any deal.
export type CouncilAnswer =
  { type: "answer"; card: string } | { type: "offer"; accept: boolean };

/** Which view the records call for: it changes only with a new crisis or a new answer. */
const viewKey = (records: CrisisRecord[]) =>
  records.length ? `${records.length}:${records.at(-1)!.pick ?? ""}` : "";
/** The hand while the latest crisis has no answer; afterwards the state to reveal. */
function councilView(records: CrisisRecord[]) {
  const record = records.at(-1)!;
  const state = councilState(records);
  if (record.pick) return { state };
  const hand = handView(state, record.id, records.length - 1);
  return { heading: hand.heading, body: `${hand.body}${standing(state)}` };
}

export function mountCrisisDialog(
  host: Element,
  options: {
    records: () => CrisisRecord[];
    /** Commits the answer through the farm's action queue; resolves once saved or refused. */
    answer: (answer: CouncilAnswer) => Promise<unknown>;
    /** Places focus once the meeting closes; the control that opened it may be gone. */
    onClose?: () => void;
  },
) {
  const dialog = document.createElement("dialog");
  dialog.id = "crisis";
  dialog.setAttribute("aria-labelledby", "crisis-heading");
  dialog.innerHTML = `<form method="dialog" class="menu-heading"><div><span class="eyebrow">Council meeting</span><h2 id="crisis-heading" tabindex="-1"></h2></div><button aria-label="Close council meeting">×</button></form><p class="crisis-error" role="alert" hidden></p><div class="crisis-body"></div>`;
  host.append(dialog);
  const heading = dialog.querySelector<HTMLElement>("#crisis-heading")!;
  const error = dialog.querySelector<HTMLElement>(".crisis-error")!;
  const body = dialog.querySelector<HTMLElement>(".crisis-body")!;
  dialog.addEventListener("close", () => options.onClose?.());
  // What each answer did to the farm, shown with its outcome until the next crisis.
  const outcomes = new Map<string, string>();
  let shown = "",
    busy = false,
    pending = false;

  const render = (force = false) => {
    const records = options.records(),
      key = viewKey(records);
    if (!key) return false;
    if (!force && key === shown) return true;
    shown = key;
    const view = councilView(records);
    if (!view.state) {
      pending = true;
      heading.textContent = view.heading;
      body.innerHTML = view.body;
    } else {
      const outcome = outcomes.get(key);
      // The farm's outcome of a deal starts with its result, so the result is said once.
      const reveal = revealView(
        view.state,
        outcome
          ? `<p class="crisis-outcome" role="status">${esc(outcome)}</p>`
          : "",
        !!outcome,
      );
      pending = reveal.pending;
      heading.textContent = reveal.heading;
      body.innerHTML = `${reveal.body}${standing(view.state)}<div class="crisis-actions"><button data-step="close"${reveal.pending ? " disabled" : ""}>Back to the farm</button></div>`;
    }
    body.scrollTop = 0;
    return true;
  };

  body.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button || button.disabled || busy) return;
    const { pick, offer, step } = button.dataset;
    if (step === "close") {
      if (!pending) dialog.close();
      return;
    }
    if (!pick && !offer) return;
    busy = true;
    dialog.setAttribute("aria-busy", "true");
    error.hidden = true;
    for (const b of body.querySelectorAll("button")) b.disabled = true;
    const before = shown;
    try {
      await options.answer(
        pick
          ? { type: "answer", card: pick }
          : { type: "offer", accept: offer === "accept" },
      );
    } finally {
      busy = false;
      dialog.removeAttribute("aria-busy");
      render(true);
      // A pick moves to its outcome; a deal answer leaves only the way back to the farm.
      if (shown !== before)
        (pick
          ? heading
          : body.querySelector<HTMLElement>('[data-step="close"]')
        )?.focus();
    }
  });

  return {
    /** Open on the waiting crisis, or on the latest outcome. */
    open() {
      if (!render(true)) return;
      error.hidden = true;
      if (!dialog.open) dialog.showModal();
      heading.focus();
    },
    /** Record what an answer did to the farm, shown with its outcome. */
    answered(message: string) {
      outcomes.set(viewKey(options.records()), message);
      if (dialog.open) render(true);
    },
    fail(message: string) {
      error.textContent = message;
      error.hidden = false;
    },
    /** Follow the save: the view changes only when the records do. */
    refresh() {
      if (!render()) {
        shown = "";
        pending = false;
        if (dialog.open) dialog.close();
      }
    },
  };
}
