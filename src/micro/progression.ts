import type { MicroState, CropId } from "./state";
import type { BuildingKind, Structure } from "./world";

export const opportunities = {
  coop: {
    need: "Harvest 3 crops",
    story:
      'Mara: "A coop gives your hens a dry home. Collect their eggs each season."',
  },
  dairy: {
    need: "Harvest 12 crops",
    story:
      'Ruth: "There is room here for dairy cows. Visit them each season to collect milk."',
  },
  sheepfold: {
    need: "Harvest 24 crops",
    story:
      'Ruth: "A sheltered flock will give you wool. Come by each season to collect it."',
  },
  shed: {
    need: "Harvest 3 crops",
    story:
      'Mara, carpenter: "You have a harvest coming in. I can build a shed to keep your seeds dry and cut the waste."',
  },
  apple: {
    need: "Harvest 6 crops",
    story:
      'Ruth, orchard grower: "Your farm is taking root. I have apple saplings to sell, if you want a crop that stays."',
  },
  corn: {
    need: "Harvest a turnip and a carrot",
    story:
      'Eli, baker: "Those vegetables sold well. Try supplying corn next. The seed merchant can get you started."',
  },
  well: {
    need: "Harvest 12 crops and own 10 plots",
    story:
      'Jo, well digger: "That is a lot of ground to water by hand. I can sink a well here when you can pay for it."',
  },
  barn: {
    need: "Harvest 24 crops",
    story:
      'Mara, carpenter: "Your harvest needs more room. A barn would keep more of it fit to sell."',
  },
  mill: {
    need: "Harvest 12 corn crops",
    story:
      'Eli, baker: "You can keep corn coming. Build a mill and I will pay more for grain you process here."',
  },
  greenhouse: {
    need: "Harvest 80 crops and improve soil once",
    story:
      'Ruth, orchard grower: "You know how to care for the ground. Let me show you a glasshouse that can protect your next crop."',
  },
  market: {
    need: "Harvest 160 crops, including turnips, carrots, and corn",
    story:
      'Eli, baker: "People come here for all sorts of produce now. A regular farm market would make those visits worth more."',
  },
  hall: {
    need: "Harvest 300 crops and build a farm market",
    story:
      'Mara, carpenter: "This market has become a meeting place. We could build a hall for the farm records and gatherings."',
  },
  soil1: {
    need: "Harvest 3 crops",
    story:
      'Ruth, orchard grower: "You have worked this soil. Compost would help the next harvest. I can show you how."',
  },
  soil2: {
    need: "Harvest 30 crops and improve soil once",
    story:
      'Ruth, orchard grower: "Your compost is paying off. You are ready to work it deeper into the beds."',
  },
  soil3: {
    need: "Harvest 90 crops and improve soil twice",
    story:
      'Ruth, orchard grower: "These beds have fed a lot of people. Another round of soil work will keep them productive."',
  },
} as const;
export type Opportunity = keyof typeof opportunities;
export const totalHarvests = (s: MicroState) =>
  Object.values(s.harvests).reduce((a, b) => a + b, 0);
export const hasOpportunity = (s: MicroState, id: Opportunity) =>
  s.opportunities.includes(id);
export const canBuild = (s: MicroState, kind: BuildingKind) =>
  kind === "home" ||
  (kind === "oak" &&
    s.structures.some((b) => b.kind === "home" && !b.pendingConstruction)) ||
  (kind !== "oak" && hasOpportunity(s, kind));
export const canPlant = (s: MicroState, crop: CropId) =>
  crop !== "corn" || hasOpportunity(s, "corn");
export const upgradeHarvests = (s: MicroState, b: Pick<Structure, "kind">) =>
  b.kind === "mill" ? s.harvests.corn : totalHarvests(s);
export const upgradeRemaining = (s: MicroState, b: Structure) =>
  Math.max(
    0,
    12 * b.level - (upgradeHarvests(s, b) - (b.harvestsAtLevel ?? 0)),
  );
export const upgradeHint = (s: MicroState, b: Structure) =>
  `Harvest ${upgradeRemaining(s, b)} more ${b.kind === "mill" ? "corn crops" : "crops"} with this level to earn an expansion`;
export function earnOpportunities(s: MicroState): Opportunity[] {
  const n = totalHarvests(s),
    h = s.harvests;
  const ready: Record<Opportunity, boolean> = {
    coop: n >= 3,
    dairy: n >= 12,
    sheepfold: n >= 24,
    shed: n >= 3,
    apple: n >= 6,
    corn: h.turnip > 0 && h.carrot > 0,
    well: n >= 12 && s.plots.length >= 10,
    barn: n >= 24,
    mill: h.corn >= 12,
    greenhouse: n >= 80 && s.soilLevel >= 1,
    market: n >= 160 && h.turnip > 0 && h.carrot > 0 && h.corn > 0,
    hall: n >= 300 && s.structures.some((b) => b.kind === "market"),
    soil1: n >= 3 || s.soilLevel >= 1,
    soil2: (n >= 30 && s.soilLevel >= 1) || s.soilLevel >= 2,
    soil3: (n >= 90 && s.soilLevel >= 2) || s.soilLevel >= 3,
  };
  // Existing saves retain access to crops and structures they already own.
  for (const b of s.structures)
    if (b.kind !== "home" && b.kind !== "oak") ready[b.kind] = true;
  if (s.plots.some((p) => p?.crop === "corn")) ready.corn = true;
  return [
    ...new Set([
      ...s.opportunities,
      ...(Object.keys(ready) as Opportunity[]).filter((id) => ready[id]),
    ]),
  ];
}
