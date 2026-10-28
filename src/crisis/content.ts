import content from "../../crisis-layer/content.json" with { type: "json" };
// engine.js reads its content from this global when it loads, so import this module first.
// Import the engine through ./engine, which keeps that order.
(globalThis as { CONTENT?: unknown }).CONTENT = content;
export default content;
