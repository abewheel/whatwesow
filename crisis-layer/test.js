// Runs the acceptance tests from the brief without a browser: `npm test`.
globalThis.CONTENT = require('./content.json');
const { sim } = require('./engine.js');
process.exit(sim.tests() ? 0 : 1);
