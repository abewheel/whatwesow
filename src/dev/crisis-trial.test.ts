import { expect, it } from "vitest";
import content from "../../crisis-layer/content.json";
import { engine, speakerFor, speakerLabel } from "./crisis-trial";
import { portraitIds, portraitRows } from "./crisis-portraits";

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
    const record = engine.replay(picks).ledger.at(-1)!;
    if (record.offer) {
      expect(engine.text.reveal(engine.replay(picks)).offer).toBe("pending");
      picks[picks.length - 1] += ":decline";
      expect(engine.text.reveal(engine.replay(picks)).offer).toBe("declined");
    }
  }
  expect(engine.replay(picks).done).toBe(true);
});

it("keeps every portrait on a 24 × 24 grid", () => {
  for (const id of portraitIds) {
    const rows = portraitRows(id)!;
    expect(rows).toHaveLength(24);
    for (const row of rows) expect(row).toHaveLength(24);
  }
});
