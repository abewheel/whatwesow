import content from "../../crisis-layer/content.json";
// engine.js reads its content from this global when it loads, so import this module first.
(globalThis as { CONTENT?: unknown }).CONTENT = content;
export default content;
