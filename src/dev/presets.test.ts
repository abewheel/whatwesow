import { expect, it } from "vitest";
import {
  controlTurns,
  crisisPresets,
  crisisTurns,
  presetState,
} from "./presets";
import { farmContext, parseState } from "../game/state";
import { answerCrisis, endTurn, pendingCrisis } from "../game/crisis";
import { councilLedger, crisisRules } from "../game/crisis-rules";
import { content } from "../crisis/engine";
import { turnNumber } from "../macro/state";
import { thirstyPlots } from "../micro/state";
it("provides valid construction scenarios with supported layouts at each era", () => {
  for (const [id, turn] of [
    ["homestead", 1],
    ["community", 25],
    ["industry", 81],
    ["legacy", 159],
    ["restricted", 25],
  ] as const) {
    const state = presetState(id);
    expect(parseState(state)).toEqual(state);
    expect(turnNumber(state)).toBe(turn);
  }
});
it("fires each crisis of the run order at the next End turn", () => {
  expect(crisisPresets.map((p) => p.label)).toEqual([
    "Crisis · drought next turn",
    "Crisis · blight next turn",
    "Crisis · eminent domain next turn",
    "Crisis · overproduction next turn",
    "Crisis · second drought next turn",
    "Crisis · price crash next turn",
    "Crisis · second eminent domain next turn",
    "Crisis · second overproduction next turn",
    "Crisis · blight, toward control",
    "Crisis · second drought, toward control",
    "Crisis · second eminent domain, toward control",
    "Crisis · second overproduction, toward control",
  ]);
  expect(crisisPresets.slice(8).map((p) => p.id)).toEqual([
    "crisis-2-control",
    "crisis-5-control",
    "crisis-7-control",
    "crisis-8-control",
  ]);
  for (const { id, n, key } of crisisPresets) {
    const turns = key === "OBJ" ? crisisTurns : controlTurns;
    const state = presetState(id);
    expect(parseState(state)).toEqual(state);
    expect(turnNumber(state)).toBe(turns[n] - 1);
    expect(state.crises ?? []).toHaveLength(n);
    expect(state.crises?.every((r) => r.pick?.endsWith(key)) ?? true).toBe(
      true,
    );
    expect(pendingCrisis(state)).toBeUndefined();
    const next = endTurn(state).state;
    expect(next.crises).toHaveLength(n + 1);
    expect(next.crises!.at(-1)).toMatchObject({
      id: content.params.runOrder[n],
      turn: turns[n],
    });
    expect(pendingCrisis(next)).toBeDefined();
  }
});
it("shows the council's harsher rules when a control preset is answered with Nora Delgado's card", () => {
  const answered = (id: string) => {
    const next = endTurn(presetState(id)).state;
    const record = next.crises!.at(-1)!;
    const card = content.cards.find(
      (c) => c.crisis === record.id && c.key === "PRO-M",
    )!;
    const result = answerCrisis(next, card.id);
    return {
      ...result,
      pos: councilLedger(result.state.crises).at(-1)!.enactedPos,
      policy: farmContext(result.state).policy,
    };
  };
  // Blight 0: dearer, treated seed and crop rotation on top of the fee.
  const blight = answered("crisis-2-control");
  expect(blight.pos).toBe(0);
  expect(blight.message).toBe("Passed: County seed checks, for a fee.");
  expect(blight.policy).toMatchObject({
    plantingFee: 2,
    seedMultiplier: 1.25,
    rotation: true,
    yieldMultiplier: 0.9,
  });
  // Drought 0 in spring: the well built since the first drought is sealed.
  const drought = answered("crisis-5-control");
  expect(drought.pos).toBe(0);
  expect(drought.state.season).toBe("spring");
  expect(drought.message).toBe("Passed: Public water company.");
  expect(drought.state.structures.some((s) => s.kind === "well")).toBe(true);
  expect(drought.policy.sealedBuildings).toEqual(["well"]);
  expect(farmContext(drought.state).water?.atCost).toBe(true);
  // Eminent domain −40: permits from the council office and the crop you may plant.
  const land = answered("crisis-7-control");
  expect(land.pos).toBe(-40);
  expect(land.message).toMatch(/^Passed: Take the land, pay a set price\./);
  expect(land.policy).toMatchObject({
    permitsRequired: true,
    seedMultiplier: 0,
  });
  expect(land.policy.assignedCrops).toHaveLength(1);
  expect(land.state.permits).toEqual([turnNumber(land.state)]);
  // Overproduction −40: a steady sales allowance and fixed prices.
  const glut = answered("crisis-8-control");
  expect(glut.pos).toBe(-40);
  expect(glut.message).toMatch(/^Passed: Limits on how much you can plant\./);
  expect(glut.policy.quota).toBe(5);
  expect(glut.state.crises!.at(-1)!.prices).toBeDefined();
  expect(glut.policy.priceCeiling).toBe(1);
});
it("grows thirsty crops into the first drought, at year 2 spring", () => {
  const state = presetState("crisis-1");
  expect([state.year, state.season]).toEqual([2, "spring"]);
  expect(thirstyPlots(state).length).toBeGreaterThan(0);
  // Without a well the corn is still growing, so still thirsty, when the drought comes.
  expect(thirstyPlots(endTurn(state).state).length).toBe(
    thirstyPlots(state).length,
  );
});
it("puts each crisis where it can hurt the farm", () => {
  // A summer blight clears the spring corn still growing.
  const blight = endTurn(presetState("crisis-2")).state;
  expect(blight.crises!.at(-1)).toMatchObject({ id: "Blight", crop: "corn" });
  expect(blight.plots.some((p) => p?.crop === "corn")).toBe(false);
  expect(blight.plots.filter((p) => p?.crop === "carrot")).toHaveLength(2);
  // The second drought finds thirsty crops growing too.
  const drought = endTurn(presetState("crisis-5")).state;
  expect(drought.season).toBe("summer");
  expect(thirstyPlots(drought).length).toBeGreaterThan(0);
  // A summer price crash covers the summer and fall harvests.
  expect(endTurn(presetState("crisis-6")).state.season).toBe("summer");
});
it("never names a county crop that another rule charges a fee for or holds the sales of", () => {
  // Nora's answers pass Overproduction 0 on pumpkin at crisis 4 and Eminent domain −40 at crisis 7.
  const state = presetState("crisis-8-control");
  for (const turn of [106, 118, 130]) {
    const rules = crisisRules(state, turn);
    const charged = rules.cropFees.map((fee) => fee.crop);
    expect(charged).toContain("pumpkin");
    expect(rules.policy.assignedCrops).toHaveLength(1);
    expect(charged).not.toContain(rules.policy.assignedCrops![0]);
    expect(rules.policy.sellDelay).not.toHaveProperty(
      rules.policy.assignedCrops![0],
    );
  }
});
