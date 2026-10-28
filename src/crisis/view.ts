import {
  content,
  engine,
  type Card,
  type Crisis,
  type CrisisState,
  type LedgerRecord,
} from "./engine";
import { portraitSvg } from "./portraits";

// Council markup shared by the in-game crisis dialog and the development Crisis test.
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

export const S = content.strings;
export const total = content.params.runOrder.length;
export const esc = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
export const fill = (template: string, vars: Record<string, string | number>) =>
  engine.text.fill(template, vars);
/** The content's "{persona} · {type}" label, with the speaker's name standing in for the persona. */
export const speakerLabel = (card: Card) =>
  fill(S.argumentType, {
    persona: speakerFor(card).name,
    type: S.premiseLabel[card.premiseType as keyof typeof S.premiseLabel],
  });
export const portrait = (card: Card) =>
  `<span class="crisis-portrait">${portraitSvg(speakerFor(card).portrait)}</span>`;
const speech = (card: Card, argument: string, className = "") =>
  `<figure class="crisis-speech ${className}">${portrait(card)}<div><blockquote>${esc(argument)}</blockquote><figcaption>${esc(speakerLabel(card))}</figcaption></div></figure>`;
const pct = (x: number) => (Math.max(-100, Math.min(100, x)) + 100) / 2;

/** The council's mood and open window on the control–freedom axis, with this crisis's policies. */
export function meter(
  state: CrisisState,
  crisis: Crisis,
  record?: LedgerRecord,
) {
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

/** "Rules you still have to follow", from the policies that passed with a lasting drag. */
export function standing(state: CrisisState) {
  return `<h3>${esc(S.standingHeading)}</h3>${
    state.standing.length
      ? `<ul class="crisis-standing">${state.standing.map((rule) => `<li><strong>${esc(rule.policy)}:</strong> ${esc(rule.text)}</li>`).join("")}</ul>`
      : `<p class="crisis-note">${esc(S.standingNone)}</p>`
  }`;
}

/** Crisis number n (0-based) before the player speaks: the trigger, the meter and five arguments. */
export function handView(state: CrisisState, crisisId: string, n: number) {
  const crisis = engine.crisisById[crisisId],
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
    body: `<p class="crisis-trigger">${esc(crisis.trigger)}</p>${previous ? `<p class="crisis-note">${esc(fill(S.facedBefore, { policy: previous.enactedName }))}</p>` : ""}${meter(state, crisis)}<h3>${esc(S.handHeading)}</h3><p class="crisis-note">${esc(S.handHint)}</p><div class="crisis-hand">${cards}</div>`,
  };
}

/**
 * The outcome of the latest answer; `after` follows the deal buttons or the deal's result.
 * `stated`: `after` already starts with the deal's result, as the farm's outcome does.
 */
export function revealView(state: CrisisState, after = "", stated = false) {
  const record = state.ledger[state.ledger.length - 1],
    crisis = engine.crisisById[record.crisisId],
    text = engine.text.reveal(state);
  // The mood moves before the vote, so the argument that closed the door can be this meeting's.
  const attribution =
    record.attributionCrisis === record.n
      ? fill(S.attributionNow, {
          tail: S.answerPast[record.premiseType as keyof typeof S.answerPast],
        })
      : text.attribution;
  const offer =
    text.offer === "pending"
      ? '<div class="crisis-actions"><button data-offer="accept">Take the deal</button><button data-offer="decline">Say no</button></div>'
      : text.offer && !stated
        ? `<p><strong>${esc(text.offerResult)}</strong></p>`
        : "";
  return {
    heading: text.heading,
    pending: text.offer === "pending",
    body: `${speech(engine.cardById[record.cardId], text.argument, "mine")}${text.opposition ? `<p class="crisis-line">${esc(text.opposition.lead)}</p>${speech(engine.opposition(record.crisisId), text.opposition.argument, "opposing")}` : ""}<p class="crisis-line">${esc(text.answer)}</p><p class="crisis-line">${esc(text.shift)}</p><p class="crisis-line">${esc(text.resolution)}</p>${attribution ? `<p class="crisis-line crisis-attribution">${esc(attribution)}</p>` : ""}${meter(state, crisis, record)}<h3>${esc(text.immediateHeading)}</h3><p>${esc(text.immediate)}</p>${offer}${after}`,
  };
}
