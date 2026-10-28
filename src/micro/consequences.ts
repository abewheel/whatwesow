import type { FarmPolicy } from "../contracts/farm-policy";
import { parseFarmPolicy } from "../contracts/farm-policy";
import { parseMicroState, type MicroState } from "./state";
import { structureSize, cellAllowed, footprint } from "./world";
export type FarmConsequences = {
  removeStructureIds?: number[];
  removePlotIds?: number[];
  coinDelta?: number;
};
/** Reconcile a macro decision atomically; never refund confiscation or reuse removed IDs. */
export function applyFarmConsequences(
  current: MicroState,
  effects: FarmConsequences = {},
  landPolicy: FarmPolicy = {},
) {
  const state = parseMicroState(current),
    policy = parseFarmPolicy(landPolicy);
  if (
    effects.coinDelta !== undefined &&
    !Number.isSafeInteger(effects.coinDelta)
  )
    throw new Error("Coin effects must be whole numbers.");
  for (const ids of [effects.removeStructureIds, effects.removePlotIds])
    if (
      ids !== undefined &&
      (!Array.isArray(ids) ||
        ids.some((id) => !Number.isSafeInteger(id) || id < 1))
    )
      throw new Error("Removal effects require valid IDs.");
  const lostStructures = state.structures.filter(
    (s) =>
      effects.removeStructureIds?.includes(s.id) ||
      footprint(s, structureSize(s).width, structureSize(s).height).some(
        (c) => !cellAllowed(c, policy),
      ),
  );
  state.structures = state.structures.filter(
    (s) => !lostStructures.some((l) => l.id === s.id),
  );
  const lostPlots = state.plotIds.filter(
    (id, i) =>
      effects.removePlotIds?.includes(id) ||
      !cellAllowed(state.plotCells[i], policy),
  );
  const kept = state.plotIds
    .map((id, i) => ({ id, cell: state.plotCells[i], crop: state.plots[i] }))
    .filter((p) => !lostPlots.includes(p.id));
  state.plotIds = kept.map((p) => p.id);
  state.plotCells = kept.map((p) => p.cell);
  state.plots = kept.map((p) => p.crop);
  state.coins += effects.coinDelta ?? 0;
  return {
    state: parseMicroState(state),
    losses: { structures: lostStructures.map((s) => s.id), plots: lostPlots },
  };
}
