import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";

// Playwright's built-in shards take consecutive tests, grouping expensive
// features together. Schedule estimated longest tests on the least-loaded runner.
export function browserShards(report, total, timings = {}) {
  if (!Number.isInteger(total) || total < 1)
    throw new Error("Shard total must be a positive integer.");
  const descriptions = [];
  function collect(suite, titles) {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests)
        descriptions.push(
          [`[${test.projectName}]`, spec.file, ...titles, spec.title].join(
            " › ",
          ),
        );
    for (const child of suite.suites ?? [])
      collect(child, [...titles, child.title]);
  }
  for (const suite of report.suites) collect(suite, []);
  if (!descriptions.length || report.errors?.length)
    throw new Error("Browser test discovery failed or returned no tests.");
  if (new Set(descriptions).size !== descriptions.length)
    throw new Error("Duplicate browser test descriptions cannot be sharded.");
  if (descriptions.length < total)
    throw new Error("More shards than discovered browser tests.");
  const shards = Array.from({ length: total }, () => []);
  const loads = Array(total).fill(0);
  const weight = (test) => {
    const estimate = timings[test.replace(/^\[[^\]]*\] › /, "")];
    return Number.isFinite(estimate) && estimate > 0 ? estimate : 10;
  };
  descriptions.sort((a, b) => weight(b) - weight(a));
  for (const test of descriptions) {
    let target = 0;
    for (let i = 1; i < total; i++) if (loads[i] < loads[target]) target = i;
    shards[target].push(test);
    loads[target] += weight(test);
  }
  return shards;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [current, total] = (process.argv[2] ?? "").split("/").map(Number);
  if (!Number.isInteger(current) || current < 1 || current > total)
    throw new Error("Specify a shard as current/total, for example 1/19.");
  const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  const listed = spawnSync(
    process.execPath,
    [cli, "test", "--list", "--reporter=json"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (listed.status !== 0)
    throw new Error(listed.stderr || "Browser discovery process failed.");
  const { durations } = JSON.parse(
    readFileSync(new URL("./browser-timings.json", import.meta.url), "utf8"),
  );
  const shards = browserShards(JSON.parse(listed.stdout), total, durations);
  const directory = mkdtempSync(join(tmpdir(), "whatwesow-browser-"));
  try {
    const list = join(directory, "tests.txt");
    writeFileSync(list, shards[current - 1].join("\n"));
    console.log(
      `Browser shard ${current}/${total}: ${shards[current - 1].length} tests`,
    );
    const result = spawnSync(
      process.execPath,
      [cli, "test", `--test-list=${list}`, ...process.argv.slice(3)],
      { stdio: "inherit" },
    );
    process.exitCode = result.status ?? 1;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
