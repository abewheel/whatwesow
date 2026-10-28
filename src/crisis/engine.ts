import content from "./content";
import "../../crisis-layer/engine.js";

/** crisis-layer/content.json, set as the engine's CONTENT before engine.js loads. */
export { content };
export type Card = (typeof content.cards)[number];
export type Crisis = (typeof content.crises)[number];
/** One entry of a policy's `effects`; see crisis-layer/INTEGRATION.md §4. */
export type Effect = { type: string; duration: string } & Record<
  string,
  string | number | boolean
>;
export type PolicyInfo = {
  pos: number;
  name: string;
  immediate: string;
  drag: string;
  effects?: Effect[];
  offer: boolean;
  missing?: true;
};
export type CrisisConfig = {
  resolution: string;
  order: string;
  startCenter: number;
  halfWidth: number;
  oppositionShift: number;
  spacing: number;
  extreme: number;
  acceptOffers?: boolean;
};
export type LedgerRecord = {
  n: number;
  crisisId: string;
  cardId: string;
  premiseType: string;
  explicitShift: number;
  oppositionShift: number;
  net: number;
  before: number;
  after: number;
  ask: number | null;
  askSource: "proposal" | "lobby" | null;
  inWindow: boolean | null;
  enactedPos: number;
  enactedName: string;
  offer: boolean;
  accepted: boolean | null;
  attributionCrisis: number | null;
};
export type CrisisState = {
  config: CrisisConfig;
  center: number;
  ledger: LedgerRecord[];
  standing: { crisisId: string; pos: number; policy: string; text: string }[];
  done: boolean;
};
export type Reveal = {
  heading: string;
  argument: string;
  label: string;
  opposition: { lead: string; argument: string; label: string } | null;
  answer: string;
  shift: string;
  resolution: string;
  attribution: string;
  immediateHeading: string;
  immediate: string;
  offer: null | "pending" | "accepted" | "declined";
  offerResult: string;
  standing: string[];
  effects: Effect[];
};
/** The parts of crisis-layer/engine.js the game calls; see crisis-layer/INTEGRATION.md. */
export type CrisisEngine = {
  replay(picks: string[], config?: Partial<CrisisConfig>): CrisisState;
  hand(crisisId: string, n: number): Card[];
  opposition(crisisId: string): Card;
  /** The enacted policy's effects, without `onAccept` ones unless the offer was accepted. */
  effectsFor(record: LedgerRecord): Effect[];
  rungs(config: CrisisConfig): number[];
  policyAt(crisis: Crisis, pos: number): PolicyInfo;
  parsePick(pick: string): {
    cardId: string;
    decision: "accept" | "decline" | null;
  };
  crisisById: Record<string, Crisis>;
  cardById: Record<string, Card>;
  text: {
    fill(template: string, vars: Record<string, string | number>): string;
    fmt(n: number | null): string;
    amount(n: number): string;
    position(center: number): string;
    moved(n: number): string;
    immediate(policy: PolicyInfo): string;
    label(card: Card): string;
    answer(record: LedgerRecord): string;
    shift(record: LedgerRecord): string;
    resolution(record: LedgerRecord): string;
    attribution(record: LedgerRecord, state: CrisisState): string;
    offerResult(record: LedgerRecord): string;
    reveal(state: CrisisState, i?: number): Reveal;
  };
};
export const engine = (globalThis as unknown as { Engine: CrisisEngine })
  .Engine;
