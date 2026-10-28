import { expect, it } from "vitest";
import { content, engine } from "../crisis/engine";
import { shiftFirst } from "../game/crisis-rules";
import { speakerFor, speakerLabel } from "../crisis/view";
import { portraitIds, portraitRows } from "../crisis/portraits";

const personas = content.personas.map((p) => p.id);
const hideIdentity = (text: string) =>
  personas.every((persona) => !text.includes(persona)) &&
  content.cards.every(
    (card) => !card.personaLabel || !text.includes(card.personaLabel),
  );

it("deals five cards for every crisis, each from a different named speaker with a portrait", () => {
  content.params.runOrder.forEach((crisisId, n) => {
    const hand = engine.hand(crisisId, n);
    expect(hand).toHaveLength(5);
    const names = hand.map((card) => speakerFor(card).name);
    expect(new Set(names).size).toBe(5);
    for (const card of hand) {
      expect(portraitIds).toContain(speakerFor(card).portrait);
      expect(hideIdentity(speakerFor(card).name)).toBe(true);
    }
  });
});

it("names every card by speaker and argument type, never by persona", () => {
  for (const card of content.cards) {
    const label = speakerLabel(card);
    expect(label).toContain(speakerFor(card).name);
    expect(hideIdentity(label)).toBe(true);
  }
});

it("plays a whole run through the engine, answering offers", () => {
  const picks: string[] = [];
  for (const crisisId of content.params.runOrder) {
    const card = engine
      .hand(crisisId, picks.length)
      .find((c) => c.key === "LIB-P")!;
    picks.push(card.id);
    const record = engine.replay(picks, shiftFirst).ledger.at(-1)!;
    if (record.offer) {
      expect(engine.text.reveal(engine.replay(picks, shiftFirst)).offer).toBe(
        "pending",
      );
      picks[picks.length - 1] += ":decline";
      expect(engine.text.reveal(engine.replay(picks, shiftFirst)).offer).toBe(
        "declined",
      );
    }
  }
  expect(engine.replay(picks, shiftFirst).done).toBe(true);
});

it("votes after the meeting moves the council, as the game does", () => {
  // Ada Kessler at the first overproduction: voting first passes the +40 deal, but her
  // argument moves the council far enough that +80 passes, with no deal.
  const picks = ["D-LIB-P", "B-LIB-P", "E-LIB-P:decline", "O-OBJ"];
  const vote = (config = {}) => engine.replay(picks, config).ledger[3];
  expect([vote().enactedPos, vote().offer]).toEqual([40, true]);
  expect([vote(shiftFirst).enactedPos, vote(shiftFirst).offer]).toEqual([
    80,
    false,
  ]);
});

it("keeps every portrait on a 24 × 24 grid", () => {
  for (const id of portraitIds) {
    const rows = portraitRows(id)!;
    expect(rows).toHaveLength(24);
    for (const row of rows) expect(row).toHaveLength(24);
  }
});
