import content from "./crisis-content";
import "../../crisis-layer/engine.js";
import { portraitSvg } from "./crisis-portraits";

/** Development-only council test: plays the crisis layer's runs without touching the farm. */
type Card = (typeof content.cards)[number];
type Crisis = (typeof content.crises)[number];
type Effect = Record<string, string | number | boolean>;
type LedgerRecord = {
  n: number;
  crisisId: string;
  cardId: string;
  before: number;
  after: number;
  ask: number | null;
  enactedPos: number;
  enactedName: string;
  offer: boolean;
  accepted: boolean | null;
};
type CrisisState = {
  config: {
    halfWidth: number;
    spacing: number;
    extreme: number;
    order: string;
  };
  center: number;
  ledger: LedgerRecord[];
  standing: { policy: string; text: string }[];
  done: boolean;
};
type Reveal = {
  heading: string;
  argument: string;
  opposition: { lead: string; argument: string } | null;
  answer: string;
  shift: string;
  resolution: string;
  attribution: string;
  immediateHeading: string;
  immediate: string;
  offer: null | "pending" | "accepted" | "declined";
  offerResult: string;
  effects: Effect[];
};
/** The parts of crisis-layer/engine.js this tool calls; see crisis-layer/INTEGRATION.md. */
export type CrisisEngine = {
  hand(crisisId: string, n: number): Card[];
  replay(picks: string[]): CrisisState;
  opposition(crisisId: string): Card;
  rungs(config: CrisisState["config"]): number[];
  policyAt(crisis: Crisis, pos: number): { name: string; missing?: true };
  parsePick(pick: string): { cardId: string };
  crisisById: Record<string, Crisis>;
  cardById: Record<string, Card>;
  text: {
    fill(template: string, vars: Record<string, string | number>): string;
    position(center: number): string;
    offerResult(record: LedgerRecord): string;
    reveal(state: CrisisState): Reveal;
  };
};
export const engine = (globalThis as unknown as { Engine: CrisisEngine })
  .Engine;

// Speakers are named people, never ideologies. Keys follow content.json card keys.
const speakers: Record<string, { name: string; portrait: string }> = {
  OBJ: { name: "Ada Kessler", portrait: "ada" },
  "LIB-P": { name: "Walt Finch", portrait: "walt" },
  "LIB-M": { name: "June Calloway", portrait: "june" },
  "PRO-P": { name: "Sam Okafor", portrait: "sam" },
  "PRO-M": { name: "Nora Delgado", portrait: "nora" },
  SOC: { name: "Tom Brennan", portrait: "tom" },
};
export const speakerFor = (card: Card) =>
  speakers[card.key] ?? { name: "A neighbor", portrait: "" };

const S = content.strings;
const total = content.params.runOrder.length;
const esc = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
const fill = (template: string, vars: Record<string, string | number>) =>
  engine.text.fill(template, vars);
/** The content's "{persona} · {type}" label, with the speaker's name standing in for the persona. */
export const speakerLabel = (card: Card) =>
  fill(S.argumentType, {
    persona: speakerFor(card).name,
    type: S.premiseLabel[card.premiseType as keyof typeof S.premiseLabel],
  });
const portrait = (card: Card) =>
  `<span class="crisis-portrait">${portraitSvg(speakerFor(card).portrait)}</span>`;
const speech = (card: Card, argument: string, className = "") =>
  `<figure class="crisis-speech ${className}">${portrait(card)}<div><blockquote>${esc(argument)}</blockquote><figcaption>${esc(speakerLabel(card))}</figcaption></div></figure>`;
const effectText = (effect: Effect) =>
  Object.entries(effect)
    .map(([key, value]) => (key === "type" ? value : `${key}=${value}`))
    .join(" ");
const pct = (x: number) => (Math.max(-100, Math.min(100, x)) + 100) / 2;

/** The council's mood and open window on the control–freedom axis, with this crisis's policies. */
function meter(state: CrisisState, crisis: Crisis, record?: LedgerRecord) {
  const half = state.config.halfWidth,
    from = record ? record.before : state.center,
    rungs = engine.rungs(state.config);
  const band = (center: number, className: string) =>
    `<span class="${className}" style="left:${pct(center - half)}%;width:${pct(center + half) - pct(center - half)}%"></span>`;
  const mood = (center: number, className: string) =>
    `<span class="${className}" style="left:${pct(center)}%"></span>`;
  const column = rungs.length > 1 ? pct(rungs[1]) - pct(rungs[0]) : 100;
  const policies = rungs
    .map((pos) => {
      const policy = engine.policyAt(crisis, pos);
      const tags = [
        record?.ask === pos ? S.markerAsked : "",
        record?.enactedPos === pos ? S.markerPassed : "",
      ].filter(Boolean);
      return `<li style="width:${column}%"${tags.length ? ' class="marked"' : ""}>${policy.missing ? "" : esc(policy.name)}${tags.map((tag) => `<em>${esc(tag)}</em>`).join("")}</li>`;
    })
    .join("");
  const legend = record
    ? [
        S.legendBefore,
        state.config.order === "shiftThenResolve"
          ? S.decidedAfter
          : S.decidedBefore,
        record.ask === null
          ? ""
          : fill(S.legendAsked, {
              policy: engine.policyAt(crisis, record.ask).name,
            }),
        fill(S.legendPassed, { policy: record.enactedName }),
      ]
        .filter(Boolean)
        .join(" ")
    : S.legendNow;
  return `<figure class="council-meter"><div class="meter-track">${band(from, "meter-window")}${record ? band(record.after, "meter-window after") : ""}${rungs.map((pos) => `<span class="meter-tick" style="left:${pct(pos)}%"></span>`).join("")}${mood(from, "meter-mood")}${record ? mood(record.after, "meter-mood after") : ""}</div><div class="meter-ends"><span>${esc(S.axisControl)}</span><span>${esc(S.axisFreedom)}</span></div><ol class="meter-policies" style="padding-left:${pct(rungs[0]) - column / 2}%">${policies}</ol><figcaption>${esc(legend)}</figcaption></figure>`;
}

function standing(state: CrisisState) {
  return `<h3>${esc(S.standingHeading)}</h3>${
    state.standing.length
      ? `<ul class="crisis-standing">${state.standing.map((rule) => `<li><strong>${esc(rule.policy)}:</strong> ${esc(rule.text)}</li>`).join("")}</ul>`
      : `<p class="crisis-note">${esc(S.standingNone)}</p>`
  }`;
}

function crisisView(state: CrisisState, picks: string[]) {
  const n = state.ledger.length,
    crisis = engine.crisisById[content.params.runOrder[n]],
    previous = state.ledger.filter((r) => r.crisisId === crisis.id).pop();
  const cards = engine
    .hand(crisis.id, n)
    .map(
      (card) =>
        `<button class="crisis-card" data-pick="${esc(card.id)}">${portrait(card)}<strong>${esc(speakerFor(card).name)}</strong><span>${esc(card.argument)}</span></button>`,
    )
    .join("");
  return {
    heading: fill(S.crisisHeading, { n: n + 1, total, title: crisis.title }),
    body: `<p class="crisis-trigger">${esc(crisis.trigger)}</p>${previous ? `<p class="crisis-note">${esc(fill(S.facedBefore, { policy: previous.enactedName }))}</p>` : ""}${meter(state, crisis)}<h3>${esc(S.handHeading)}</h3><p class="crisis-note">${esc(S.handHint)}</p><div class="crisis-hand">${cards}</div>${standing(state)}<div class="crisis-actions">${picks.length ? '<button data-step="undo">Undo last pick</button>' : ""}<button data-step="restart">Start over</button></div>`,
  };
}

function revealView(state: CrisisState) {
  const record = state.ledger[state.ledger.length - 1],
    crisis = engine.crisisById[record.crisisId],
    text = engine.text.reveal(state);
  const offer =
    text.offer === "pending"
      ? '<div class="crisis-actions"><button data-offer="accept">Take the deal</button><button data-offer="decline">Say no</button></div>'
      : text.offer
        ? `<p><strong>${esc(text.offerResult)}</strong></p>`
        : "";
  const effects = text.effects.length
    ? `<ul>${text.effects.map((e) => `<li><code>${esc(effectText(e))}</code></li>`).join("")}</ul>`
    : "<p>None.</p>";
  return {
    heading: text.heading,
    body: `${speech(engine.cardById[record.cardId], text.argument, "mine")}${text.opposition ? `<p class="crisis-line">${esc(text.opposition.lead)}</p>${speech(engine.opposition(record.crisisId), text.opposition.argument, "opposing")}` : ""}<p class="crisis-line">${esc(text.answer)}</p><p class="crisis-line">${esc(text.shift)}</p><p class="crisis-line">${esc(text.resolution)}</p>${text.attribution ? `<p class="crisis-line crisis-attribution">${esc(text.attribution)}</p>` : ""}${meter(state, crisis, record)}<h3>${esc(text.immediateHeading)}</h3><p>${esc(text.immediate)}</p>${offer}<details class="crisis-effects"><summary>Farm effects · not applied in this test</summary>${effects}</details>${standing(state)}<div class="crisis-actions"><button data-step="next"${text.offer === "pending" ? " disabled" : ""}>${state.done ? "See how it went" : "Next crisis"}</button><button data-step="undo">Undo pick</button></div>`,
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
type View = "crisis" | "reveal" | "report";
function restore(): { picks: string[]; view: View } {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null");
    if (
      Array.isArray(saved?.picks) &&
      ["crisis", "reveal", "report"].includes(saved.view)
    ) {
      engine.replay(saved.picks);
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
  document.querySelector("#open-menu")!.before(open);
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
      state = engine.replay(picks);
    } catch {
      picks = [];
      state = engine.replay(picks);
    }
    // A deal is answered before play continues. Picks restored after a content
    // edit can land on one earlier in the run, so resume at the first unanswered deal.
    const unanswered = state.ledger.findIndex(
      (r) => r.offer && r.accepted === null,
    );
    if (unanswered >= 0) {
      picks = picks.slice(0, unanswered + 1);
      state = engine.replay(picks);
      view = "reveal";
    }
    if (view === "reveal" && !state.ledger.length) view = "crisis";
    if (view === "report" && !state.done) view = "crisis";
    if (view === "crisis" && state.done) view = "report";
    const screen =
      view === "reveal"
        ? revealView(state)
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
    } else if (step === "next")
      go(engine.replay(picks).done ? "report" : "crisis");
    else if (step === "undo") {
      picks.pop();
      go("crisis");
    } else if (step === "restart") {
      picks = [];
      go("crisis");
    }
  });
}
