import {
  content,
  engine,
  type CrisisState,
  type Effect,
} from "../crisis/engine";
import { shiftFirst } from "../game/crisis-rules";
import {
  S,
  esc,
  fill,
  handView,
  portrait,
  revealView,
  speakerFor,
  standing,
} from "../crisis/view";

// Development-only council test: plays the crisis layer's runs without touching the farm.
const effectText = (effect: Effect) =>
  Object.entries(effect)
    .map(([key, value]) => (key === "type" ? value : `${key}=${value}`))
    .join(" ");

function crisisView(state: CrisisState, picks: string[]) {
  const n = state.ledger.length;
  const hand = handView(state, content.params.runOrder[n], n);
  return {
    heading: hand.heading,
    body: `${hand.body}${standing(state)}<div class="crisis-actions">${picks.length ? '<button data-step="undo">Undo last pick</button>' : ""}<button data-step="restart">Start over</button></div>`,
  };
}

function trialReveal(state: CrisisState) {
  const text = engine.text.reveal(state);
  const effects = text.effects.length
    ? `<ul>${text.effects.map((e) => `<li><code>${esc(effectText(e))}</code></li>`).join("")}</ul>`
    : "<p>None.</p>";
  const reveal = revealView(
    state,
    `<details class="crisis-effects"><summary>Farm effects · not applied in this test</summary>${effects}</details>`,
  );
  return {
    heading: reveal.heading,
    body: `${reveal.body}${standing(state)}<div class="crisis-actions"><button data-step="next"${reveal.pending ? " disabled" : ""}>${state.done ? "See how it went" : "Next crisis"}</button><button data-step="undo">Undo pick</button></div>`,
  };
}

function reportView(state: CrisisState) {
  const rows = state.ledger
    .map((record) => {
      const crisis = engine.crisisById[record.crisisId],
        card = engine.cardById[record.cardId];
      const lines = [
        record.ask === null
          ? ""
          : fill(S.legendAsked, {
              policy: engine.policyAt(crisis, record.ask).name,
            }),
        fill(S.legendPassed, { policy: record.enactedName }),
        engine.text.offerResult(record),
      ].filter(Boolean);
      return `<li>${portrait(card)}<div><strong>${record.n}. ${esc(crisis.title)} · ${esc(speakerFor(card).name)}</strong>${lines.map((line) => `<span>${esc(line)}</span>`).join("")}</div></li>`;
    })
    .join("");
  return {
    heading: S.reportHeading,
    body: `<ol class="crisis-report">${rows}</ol><p><strong>${esc(S.reportFinal)}:</strong> ${esc(engine.text.position(state.center))}</p>${standing(state)}<div class="crisis-actions"><button data-step="restart">Start over</button></div>`,
  };
}

const storeKey = "whatwesow-crisis-trial";
const replay = (picks: string[]) => engine.replay(picks, shiftFirst);
type View = "crisis" | "reveal" | "report";
function restore(): { picks: string[]; view: View } {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null");
    if (
      Array.isArray(saved?.picks) &&
      ["crisis", "reveal", "report"].includes(saved.view)
    ) {
      replay(saved.picks);
      return saved;
    }
  } catch {
    // Unreadable storage or picks that no longer match the content: start over.
  }
  return { picks: [], view: "crisis" };
}

export function mountCrisisTrial() {
  let { picks, view } = restore();
  const open = document.createElement("button");
  open.id = "crisis-test";
  open.setAttribute("aria-haspopup", "dialog");
  open.textContent = "Crisis test";
  document.querySelector(".corner-controls")!.append(open);
  const dialog = document.createElement("dialog");
  dialog.id = "crisis-trial";
  dialog.setAttribute("aria-labelledby", "crisis-title");
  dialog.innerHTML = `<form method="dialog" class="menu-heading"><div><span class="eyebrow">Council test · the farm is not changed</span><h2 id="crisis-title" tabindex="-1"></h2></div><button aria-label="Close crisis test">✕</button></form><div class="crisis-body"></div>`;
  document.querySelector(".farm-card")!.append(dialog);
  const title = dialog.querySelector<HTMLElement>("#crisis-title")!;
  const body = dialog.querySelector<HTMLElement>(".crisis-body")!;

  const render = () => {
    let state: CrisisState;
    try {
      state = replay(picks);
    } catch {
      picks = [];
      state = replay(picks);
    }
    // A deal is answered before play continues. Picks restored after a content
    // edit can land on one earlier in the run, so resume at the first unanswered deal.
    const unanswered = state.ledger.findIndex(
      (r) => r.offer && r.accepted === null,
    );
    if (unanswered >= 0) {
      picks = picks.slice(0, unanswered + 1);
      state = replay(picks);
      view = "reveal";
    }
    if (view === "reveal" && !state.ledger.length) view = "crisis";
    if (view === "report" && !state.done) view = "crisis";
    if (view === "crisis" && state.done) view = "report";
    const screen =
      view === "reveal"
        ? trialReveal(state)
        : view === "report"
          ? reportView(state)
          : crisisView(state, picks);
    title.textContent = screen.heading;
    body.innerHTML = screen.body;
    try {
      localStorage.setItem(storeKey, JSON.stringify({ picks, view }));
    } catch {
      // Storage is a convenience here; the test still works without it.
    }
    return state;
  };
  const go = (next: View) => {
    view = next;
    render();
    dialog.scrollTop = 0;
    title.focus();
  };
  open.addEventListener("click", () => {
    dialog.showModal();
    go(view);
  });
  body.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button || button.disabled) return;
    const { pick, offer, step } = button.dataset;
    if (pick) {
      picks.push(pick);
      go("reveal");
    } else if (offer) {
      picks[picks.length - 1] =
        `${engine.parsePick(picks[picks.length - 1]).cardId}:${offer}`;
      render();
      body.querySelector<HTMLButtonElement>('[data-step="next"]')?.focus();
    } else if (step === "next") go(replay(picks).done ? "report" : "crisis");
    else if (step === "undo") {
      picks.pop();
      go("crisis");
    } else if (step === "restart") {
      picks = [];
      go("crisis");
    }
  });
}
