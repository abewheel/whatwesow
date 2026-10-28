import { expect, it } from "vitest";
import { homesteadMicroState, parseMicroState } from "./state";
import { actOnFarm, completeUpgrades } from "./rules";
import {
  animalProducts,
  seasonTrees,
  seasonalIncome,
  type AnimalKind,
} from "./world";

it.each(Object.keys(animalProducts) as AnimalKind[])(
  "%s produces only collectible seasonal income",
  (kind) => {
    let s = {
      ...homesteadMicroState(),
      coins: 10000,
      harvests: { ...homesteadMicroState().harvests, turnip: 30 },
    };
    s = actOnFarm(s, { type: "build", kind, cell: { row: 0, col: 0 } }).state;
    const id = s.structures.at(-1)!.id;
    expect(() => actOnFarm(s, { type: "collectAnimal", id })).toThrow();
    s = completeUpgrades(s);
    for (const season of ["spring", "summer", "fall", "winter"]) {
      s.structures = seasonTrees(s.structures, season);
      s = parseMicroState(JSON.parse(JSON.stringify(s)));
      const before = s.coins;
      expect(seasonalIncome(s)).toBe(0);
      const collected = actOnFarm(s, { type: "collectAnimal", id }).state;
      expect(s.structures.at(-1)!.product).toBe(true);
      expect(collected.coins).toBe(before + animalProducts[kind].value);
      expect(() =>
        actOnFarm(collected, { type: "collectAnimal", id }),
      ).toThrow();
      expect(() =>
        actOnFarm(
          s,
          { type: "collectAnimal", id },
          { turn: 2, policy: { land: [] } },
        ),
      ).toThrow();
      s = collected;
    }
    s.structures.at(-1)!.level = 2;
    s.structures = seasonTrees(s.structures, "spring");
    expect(
      actOnFarm(
        s,
        { type: "collectAnimal", id },
        { turn: 5, policy: { productionMultiplier: 0.5 } },
      ).state.coins,
    ).toBe(s.coins + animalProducts[kind].value);
  },
);
