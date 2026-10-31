import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const local = `${root}/assets/local/v2`;
await mkdir(`${root}/compositions`, { recursive: true });
const edits = [];
async function cut(name, take, start, end, duration, offset = -0.45) {
  const path = `${local}/${name}.mp4`;
  if (!process.env.SKIP_CUTS)
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(start + offset),
      "-i",
      `${local}/${take}.webm`,
      "-t",
      String(duration),
      "-an",
      "-vf",
      `trim=duration=${end - start},setpts=(PTS-STARTPTS)*${duration / (end - start)},fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=0.4,trim=duration=${duration}`,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "16",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path,
    ]);
  if (!process.env.SKIP_CUTS) {
    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          path,
        ],
        { encoding: "utf8" },
      ),
    );
    if (Math.abs(Number(probe.format.duration) - duration) > 1 / 30)
      throw Error(
        `${name}: encoded duration ${probe.format.duration}s does not match ${duration}s`,
      );
  }
  edits.push({ name, take, in: start + offset, out: end + offset, duration });
}

const events = {};
for (const id of ["dirty", "small", "medium"])
  events[id] = Object.fromEntries(
    JSON.parse(await readFile(`${local}/${id}-timing.json`, "utf8")).events.map(
      (e) => [e.name, e.t],
    ),
  );
for (const [id, d] of [
  ["dirty", 5.6],
  ["small", 5.6],
  ["medium", 5.6],
])
  // The opening must start after camera setup, not in its last pre-roll frame.
  await cut(
    id,
    id,
    events[id].action,
    events[id].worked + 0.15,
    d,
    id === "dirty" ? 0 : -0.45,
  );
const estateEvents = Object.fromEntries(
  JSON.parse(
    await readFile(`${root}/assets/local/v4/estate-timing.json`, "utf8"),
  ).events.map((e) => [e.name, e.t]),
);
await cut(
  "estate",
  "../v4/estate",
  estateEvents.action,
  estateEvents.worked + 0.15,
  9,
);
await writeFile(
  `${root}/edits.json`,
  JSON.stringify(
    {
      sourceCommit: "8a4cd39",
      offsetNote:
        "Opening starts at its action mark to exclude camera setup; other clips retain -0.45s pre-roll. All actions captured in real browser.",
      edits,
    },
    null,
    2,
  ),
);
const css = `@font-face{font-family:Farm;src:url('assets/fonts/farm-readable.ttf');font-weight:400 700;unicode-range:U+0030,U+0032,U+0035-0037,U+006C}@font-face{font-family:Farm;src:url('assets/fonts/pixelify-sans.ttf');font-weight:400 700;unicode-range:U+0000-002F,U+0031,U+0033-0034,U+0038-006B,U+006D-10FFFF}@font-face{font-family:Pixel;src:url('assets/fonts/pixelify-sans.ttf')}*{box-sizing:border-box}#root{position:absolute;inset:0;overflow:hidden;color:#fff5d5;font-family:Farm;font-variant-ligatures:none}.clip{position:absolute;inset:0;width:1920px;height:1080px}.camera{position:absolute;inset:0;width:1920px;height:1080px;transform-origin:0 0}.camera img,.camera video{width:1920px;height:1080px;object-fit:cover;display:block}.label{position:absolute;left:150px;top:125px;padding:18px 26px;font:44px Farm;color:#fff4d0;background:#233e2b;border-left:5px solid #eacb7d;z-index:20;max-width:1000px}.bottom{top:auto;bottom:120px}.small{font-size:32px}.title{position:absolute;left:150px;top:130px;font:88px Pixel;color:#fff4d0;text-shadow:0 4px 0 #2d432a;z-index:30}.tagline{position:absolute;left:158px;top:270px;font:44px Farm;color:#fff4d0;text-shadow:0 3px 0 #2d432a;z-index:30}.tagline span{display:block;line-height:1.2}.url{position:absolute;left:158px;top:410px;font:42px Farm;color:#fff4d0;text-shadow:0 2px 0 #2d432a;z-index:30}`;
const pose = (scale, x = 960, y = 540) => ({
  scale,
  x: Math.max(1920 - 1920 * scale, Math.min(0, 960 - x * scale)),
  y: Math.max(1080 - 1080 * scale, Math.min(0, 540 - y * scale)),
});
function video(id, file, start, duration) {
  return `<div class="camera" data-layout-allow-overflow id="${id}-camera"><video id="${id}" class="clip" src="assets/local/v2/${file}.mp4" data-start="${start}" data-duration="${duration}" data-track-index="0" data-hf-media-start-basis="local" data-beat muted playsinline></video></div>`;
}
function plate(id, file, start, duration) {
  return `<div class="camera" data-layout-allow-overflow id="${id}-camera"><img id="${id}" class="clip" src="assets/local/v2/${file}.png" data-start="${start}" data-duration="${duration}" data-track-index="0" alt="Actual game capture"></div>`;
}
async function scene(id, duration, body, code) {
  await writeFile(
    `${root}/compositions/${id}.html`,
    `<template><style>${css}</style><div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-layout-allow-overlap>${body}</div><script>const tl=gsap.timeline({paused:true});${code}window.__timelines['${id}']=tl;</script></template>`,
  );
}

let body = "",
  code = "";
for (const [id, start, d] of [
  ["dirty", 0, 5.6],
  ["small", 5, 5.6],
  ["medium", 10, 5.6],
  ["big", 15, 9],
]) {
  body += video(`grow-${id}`, id === "big" ? "estate" : id, start, d);
  const camera = `#grow-${id}-camera`;
  // Crossfade incoming real gameplay, leaving the outgoing farmer in motion.
  if (start)
    code += `tl.fromTo('${camera}',{opacity:0},{opacity:1,duration:.6,ease:'none'},${start});`;
  const a = id === "big" ? pose(1.03, 960, 540) : pose(1.12, 960, 600);
  const b = id === "big" ? pose(1, 960, 540) : a;
  code += `tl.fromTo('${camera}',${JSON.stringify(a)},{...${JSON.stringify(b)},duration:${d},ease:'none'},${start});`;
}
await scene("grow", 24, body, code);
const wide = pose(1),
  nora = pose(2.65, 960, 650),
  ada = pose(2.65, 1417, 650);
body = plate("council-plate", "rights-council", 0, 11).replace(
  "alt=",
  "data-hold alt=",
);
body +=
  '<div class="camera" data-layout-allow-overflow id="council-focus"><div id="council-outline" style="position:absolute;left:1321px;top:669px;width:190px;height:104px;border:3px solid #c18c35;background:rgba(255,220,100,.09);opacity:0" data-layout-allow-overlap></div></div>';
code = `tl.fromTo('#council-plate-camera',${JSON.stringify(wide)},{...${JSON.stringify(nora)},duration:.8,ease:'power2.inOut'},.5);tl.to('#council-plate-camera',{...${JSON.stringify(ada)},duration:.8,ease:'power2.inOut'},3.5);tl.fromTo('#council-focus',${JSON.stringify(ada)},{...${JSON.stringify(ada)},duration:6.7},4.3);tl.to('#council-outline',{opacity:1,duration:.3},4.8);`;
await scene("council", 11, body, code);
const densePlate = (id, file, start, duration) =>
  plate(id, file, start, duration)
    .replace("assets/local/v2/", "assets/local/v3/")
    .replace("alt=", "data-hold alt=");
body =
  densePlate("confiscation-before", "confiscation-before", 0, 10) +
  densePlate("confiscation-after", "confiscation-after", 4, 6);
const dense = pose(2.666667, 760, 617.5);
code = `tl.fromTo('#confiscation-before-camera',${JSON.stringify(dense)},{...${JSON.stringify(dense)},duration:10},0);tl.fromTo('#confiscation-after-camera',${JSON.stringify({ ...dense, opacity: 0 })},{...${JSON.stringify({ ...dense, opacity: 1 })},duration:.45,ease:'power2.inOut'},4);`;
await scene("consequence", 10, body, code);
// Hold the actual pre-selection council image. The cursor selects the same Ada
// argument as the recorded rights take; cut on its press, before any result UI.
body =
  plate("defend-choice", "rights-council", 0, 2).replace(
    "alt=",
    "data-hold alt=",
  ) +
  '<div class="camera" id="defend-pointer-camera" data-layout-allow-overflow><div class="clip" id="defend-pointer" data-start="0" data-duration="2" data-track-index="2" aria-hidden="true"><div id="defend-cursor" style="position:absolute;width:60px;height:76px;transform-origin:3px 2px"><svg viewBox="0 0 30 38" width="60" height="76"><path d="M3 2L3 31L11 23L17 35L23 32L17 20L28 20Z" fill="#fff7da" stroke="#362819" stroke-width="2.4"/></svg></div></div></div>' +
  plate("defend-kept", "winter-estate", 2, 2)
    .replace("assets/local/v2/", "assets/local/v4/")
    .replace("alt=", "data-hold alt=");
const defenseFrame = pose(1.125, 960, 480);
code = `tl.fromTo('#defend-choice-camera',${JSON.stringify(defenseFrame)},{...${JSON.stringify(defenseFrame)},duration:2},0);tl.fromTo('#defend-pointer-camera',${JSON.stringify(defenseFrame)},{...${JSON.stringify(defenseFrame)},duration:2},0);tl.fromTo('#defend-cursor',{x:980,y:830},{x:1411,y:696,duration:1.25,ease:'power2.inOut'},.35);tl.to('#defend-cursor',{scale:.82,duration:.1,ease:'power1.in'},1.9);tl.fromTo('#defend-kept-camera',${JSON.stringify(pose(1))},{...${JSON.stringify(pose(1))},duration:2},2);`;
await scene("defend", 4, body, code);
body =
  '<div class="camera" id="close-landscape-camera" data-layout-allow-overflow><img class="clip" id="close-landscape" src="assets/local/v2/start-background.jpg" data-start="0" data-duration="6" data-track-index="0" alt="The actual start menu landscape"></div><div class="clip" id="close-shade" data-start="0" data-duration="6" data-track-index="2" aria-hidden="true" style="background:linear-gradient(#08160e66,#08160e66),radial-gradient(ellipse at center,#162b20a6 0%,#162b2033 55%,transparent 85%)"></div><div class="clip" id="close-words" data-start=".2" data-duration="5.8" data-track-index="3" data-layout-allow-overlap><div class="title" style="top:410px;left:0;width:1920px;text-align:center;font-size:112px" data-var-text="title">What We Sow</div><div class="url" style="top:555px;left:0;width:1920px;text-align:center">whatwesow.com</div></div>';
code = `tl.fromTo('#close-landscape-camera',${JSON.stringify(pose(1.035))},{...${JSON.stringify(pose(1))},duration:6,ease:'none'},0);tl.fromTo('#close-words .title',{y:15,opacity:0},{y:0,opacity:1,duration:.65,ease:'power3.out'},.2);tl.fromTo('#close-words .url',{opacity:0},{opacity:1,duration:.5},.7);`;
await scene("close", 6, body, code);
const captions = [
  [0.2, 3.1, "Start with a patch of rough land."],
  [3.1, 5.2, "Clear it."],
  [5.2, 7.6, "Plant it."],
  [7.6, 10, "Grow something worth keeping."],
  [10, 13.1, "Harvest. Reinvest. Build."],
  [13.1, 16.4, "A small farm becomes a living."],
  [16.4, 20.2, "A living becomes a lifetime’s work."],
  [20.2, 24, "Every harvest gives you more to protect."],
  [24, 27.5, "Now the county is in a drought."],
  [27.5, 30.4, "They want your land to help."],
  [30.4, 32.5, "But does a good cause"],
  [32.5, 35, "erase your right to your land?"],
  [35, 38, "Your work. Your land."],
  [38, 40, "Until the county takes it."],
  [40, 43, "Years of work. Gone."],
  [43, 45, "No right to refuse."],
  [45, 47, "Defend your rights."],
  [47, 49, "Keep what you built."],
  [49.2, 52, "Make the moral case for capitalism."],
  [52, 54.9, "Learn to make that case yourself."],
];
body =
  "<style>.caption-position{position:absolute;left:192px;right:192px;bottom:115px;text-align:center}.caption-text{display:inline-block;max-width:1536px;padding:12px 24px;background:rgba(19,39,28,.88);color:#fff5d5;font:54px/1.16 Farm;border-radius:5px;text-shadow:0 2px 0 #17341e}</style>";
code = "";
for (const [i, [start, end, text]] of captions.entries()) {
  body += `<div class="clip" id="caption-${i}" data-start="${start}" data-duration="${end - start}" data-track-index="0" data-layout-allow-overlap><div class="caption-position"><span class="caption-text" data-var-text="caption-${i}">${text}</span></div></div>`;
  code += `tl.fromTo('#caption-${i} .caption-text',{opacity:0},{opacity:1,duration:.12},${start});tl.to('#caption-${i} .caption-text',{opacity:0,duration:.1},${end - 0.1});`;
}
await scene("captions", 55, body, code);
const hosts = [
  ["grow", 0, 24],
  ["council", 24, 11],
  ["consequence", 35, 10],
  ["defend", 45, 4],
  ["close", 49, 6],
  ["captions", 0, 55],
]
  .map(
    ([id, start, d]) =>
      `<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${d}" data-track-index="${id === "captions" ? 5 : 1}" data-track-kind="${id === "captions" ? "captions" : "graphics"}" data-width="1920" data-height="1080" style="z-index:${id === "captions" ? 10 : 1}"></div>`,
  )
  .join("\n");
const sounds = [46.9]
  .map(
    (t, i) =>
      `<audio id="click-${i}" class="clip" src="assets/local/click.mp3" data-start="${t}" data-duration=".4" data-volume=".35" data-track-index="11"></audio>`,
  )
  .join("");
await writeFile(
  `${root}/index.html`,
  `<!doctype html><html lang="en" data-composition-variables='[{"id":"title","type":"string","label":"Game title","default":"What We Sow"}]'><head><meta charset="utf-8"><script src="assets/gsap.min.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden}#root{position:relative;width:1920px;height:1080px}.clip{position:absolute;inset:0;width:1920px;height:1080px}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="55" data-width="1920" data-height="1080" data-fps="30"><div style="position:absolute;inset:0;background:#315336"></div>${hosts}<audio id="score" class="clip" src="assets/local/score.m4a" data-start="0" data-duration="55" data-track-index="10" data-volume="1" data-automation='{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":1},{"t":53,"v":1},{"t":55,"v":0}]}]}'></audio>${sounds}</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>`,
);
const stamp = (t) =>
  new Date(t * 1000).toISOString().slice(11, 23).replace(".", ",");
await writeFile(
  `${root}/renders/what-we-sow.srt`,
  captions
    .map(([s, e, t], i) => `${i + 1}\n${stamp(s)} --> ${stamp(e)}\n${t}\n`)
    .join("\n"),
);
await writeFile(
  `${root}/SCRIPT.md`,
  "# Caption talk track\n\nMusic only, no spoken voice. Each caption is burned into the film and supplied as SRT.\n\n" +
    captions.map(([s, e, t]) => `${s}–${e}s: ${t}`).join("\n\n") +
    "\n",
);
await copyFile(`${root}/assets/local/v4/estate.png`, `${root}/poster.png`);
console.log("Built revised six-scene film with captions: 1650 frames.");
