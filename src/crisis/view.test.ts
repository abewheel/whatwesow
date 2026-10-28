import { expect, it } from "vitest";
import { content, engine } from "./engine";
import { shiftFirst } from "../game/crisis-rules";
import { handView, revealView, speakerFor } from "./view";

const personas = [
  ...content.personas.map((p) => p.id),
  ...content.cards.flatMap((c) => (c.personaLabel ? [c.personaLabel] : [])),
];
const card = (crisisId: string, key: string) =>
  content.cards.find((c) => c.crisis === crisisId && c.key === key)!.id;

it("deals the hand as five named speakers, never by persona", () => {
  const view = handView(engine.replay([]), "Drought", 0);
  expect(view.heading).toBe("Crisis 1 of 8: Drought");
  const picks = [...view.body.matchAll(/data-pick="([^"]+)"/g)].map(
    (m) => m[1],
  );
  expect(picks).toEqual(engine.hand("Drought", 0).map((c) => c.id));
  for (const c of engine.hand("Drought", 0))
    expect(view.body).toContain(speakerFor(c).name);
  expect(view.body).toContain(content.strings.handHeading);
  for (const persona of personas) expect(view.body).not.toContain(persona);
});

it("keeps a deal open until it is taken or refused", () => {
  const picks = [
    card("Drought", "LIB-P"),
    card("Blight", "LIB-P"),
    card("Eminent domain", "LIB-P"),
  ];
  const pending = revealView(engine.replay(picks), "<p>after</p>");
  expect(pending.pending).toBe(true);
  expect(pending.body).toContain('data-offer="accept"');
  expect(pending.body.endsWith("<p>after</p>")).toBe(true);
  picks[2] += ":decline";
  const answered = revealView(engine.replay(picks));
  expect(answered.pending).toBe(false);
  expect(answered.body).toContain(content.strings.offerDeclined);
  for (const persona of personas) expect(answered.body).not.toContain(persona);
  // Other content after the reveal keeps the deal's result.
  const notes = revealView(engine.replay(picks), "<p>notes</p>");
  expect(notes.body.split(content.strings.offerDeclined)).toHaveLength(2);
  // The farm's outcome repeats the deal's result, so it is shown once.
  const outcome = `<p class="crisis-outcome">${content.strings.offerDeclined} The farm is unchanged.</p>`;
  const after = revealView(engine.replay(picks), outcome, true);
  expect(after.body.split(content.strings.offerDeclined)).toHaveLength(2);
  expect(after.body.endsWith(outcome)).toBe(true);
});

it("names this meeting when its own arguments closed the door", () => {
  // Tom Brennan three times takes the council from +50 to +5. June Calloway then asks for the
  // farmers' group (+40); her argument and the case for control move it to −6 before the vote.
  const picks = [
    card("Drought", "SOC"),
    card("Blight", "SOC"),
    card("Eminent domain", "SOC"),
    card("Overproduction", "LIB-M"),
  ];
  const record = engine.replay(picks, shiftFirst).ledger[3];
  expect([record.before, record.after, record.enactedPos]).toEqual([5, -6, 0]);
  expect(record.attributionCrisis).toBe(4);
  const view = revealView(engine.replay(picks, shiftFirst));
  expect(view.body).toContain(
    "The arguments at this meeting moved the council away from that idea.",
  );
  expect(view.body).not.toContain("back in crisis 4");
});
