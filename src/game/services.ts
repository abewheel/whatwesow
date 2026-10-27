import { isTree, type BuildingKind } from "../micro/world";

export const serviceMenus = {
  home: {
    name: "Farmhouse",
    description:
      "Look over your farm's income and finish the season when you are ready.",
    container: "home-actions",
  },
  seeds: {
    name: "Seed shop & nursery",
    description:
      "Choose crop seeds or buy a sapling to plant. Crop seeds are paid for as you plant each plot. Delivery work is available here when you need seed money.",
    container: "seed-actions",
  },
  fields: {
    name: "Field shed",
    description:
      "Prepare crop plots, improve the soil with compost, or care for your orchard. Plant and harvest crops directly on the fields. Crops grow when the season ends.",
    container: "field-actions",
  },
  builder: {
    name: "Builder's workshop",
    description:
      "Choose a plan to commission a building, or select one of your buildings to upgrade its facilities or move it.",
    container: "builder-actions",
  },
} as const;
export type ServiceId = keyof typeof serviceMenus;
export { isTree };
export const constructionService = (kind: BuildingKind | "plot"): ServiceId =>
  kind === "plot" ? "fields" : isTree(kind) ? "seeds" : "builder";
export const inspectionService = (kind: BuildingKind): ServiceId =>
  kind === "home" ? "home" : isTree(kind) ? "fields" : "builder";
