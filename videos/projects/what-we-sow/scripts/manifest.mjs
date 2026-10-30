import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const paths = new Set([
  "assets/gsap.min.js",
  "assets/fonts/pixelify-sans.ttf",
  "assets/fonts/farm-readable.ttf",
  "assets/fonts/OFL.txt",
]);
for (const file of [
  "index.html",
  ...(await readdir(`${root}/compositions`))
    .filter((x) => x.endsWith(".html"))
    .map((x) => `compositions/${x}`),
]) {
  const text = await readFile(`${root}/${file}`, "utf8");
  for (const [, path] of text.matchAll(
    /(?:src|url)\s*(?:=\s*["']|\(\s*["']?)(assets\/[^"')>\s]+)/g,
  ))
    paths.add(path);
}
const assets = [];
for (const path of [...paths].sort()) {
  const data = await readFile(`${root}/${path}`);
  assets.push({
    path,
    bytes: (await stat(`${root}/${path}`)).size,
    sha256: createHash("sha256").update(data).digest("hex"),
    source: path.endsWith("score.m4a")
      ? "CC0 Holizna, Quiet Village 1; excerpt, gain automation, normalized"
      : path.endsWith("click.mp3")
        ? "HyperFrames bundled click-soft"
        : path.endsWith("start-background.jpg")
          ? "What We Sow public/art/starter-landscape.jpg, actual start-menu background"
          : path.includes("estate")
            ? "What We Sow estate capture: 96 plots, 13 buildings, 11 oaks; native game presentation, no tree-label patch"
            : path.includes("/v3/confiscation-")
              ? "Requested cinematic fixture rendered in What We Sow: 1600 uniform corn plots, 256-plot corner loss with updated seized-ground artwork; production rule unchanged"
              : path.endsWith(".mp4") || path.endsWith(".png")
                ? "What We Sow gameplay at 68f3809"
                : path.includes("/fonts/")
                  ? "Game typography; SIL Open Font License"
                  : "GSAP 3.15.0, original header retained",
  });
}
await writeFile(
  `${root}/assets/manifest.json`,
  JSON.stringify(
    {
      sourceCommit: "68f3809",
      renderer: "hyperframes@0.8.214",
      dimensions: [1920, 1080],
      fps: 30,
      seconds: 55,
      assets,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${assets.length} local assets checked and hashed.`);
