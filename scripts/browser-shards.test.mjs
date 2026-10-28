import { expect, test } from "vitest";
import { browserShards } from "./browser-shards.mjs";

const spec = (title, projectName = "") => ({
  title,
  file: "farm.spec.ts",
  tests: [{ projectName }],
});
const report = {
  suites: [
    {
      specs: [spec("first"), spec("second"), spec("third")],
      suites: [
        {
          title: "phone",
          specs: [spec("same line, first"), spec("same line, second")],
        },
      ],
    },
    { specs: [spec("other project", "webkit")] },
  ],
};

test("deals all discovered tests exactly once and preserves parameterized titles and projects", () => {
  const shards = browserShards(report, 3);
  expect(shards.map((shard) => shard.length)).toEqual([2, 2, 2]);
  expect(shards[0]).toEqual([
    "[] › farm.spec.ts › first",
    "[] › farm.spec.ts › phone › same line, first",
  ]);
  const all = shards.flat();
  expect(new Set(all).size).toBe(6);
  expect(all).toContain("[webkit] › farm.spec.ts › other project");
  expect(browserShards(report, 3)).toEqual(shards);
});

test("fails closed on invalid totals, empty discovery, discovery errors, and duplicates", () => {
  for (const total of [0, -1, 1.5, NaN, 7])
    expect(() => browserShards(report, total)).toThrow();
  expect(() => browserShards({ suites: [] }, 1)).toThrow();
  expect(() => browserShards({ ...report, errors: [{}] }, 1)).toThrow();
  expect(() =>
    browserShards({ suites: [report.suites[0], report.suites[0]] }, 1),
  ).toThrow();
});
