import { test, expect } from "./fixtures";

test("ground shadows preserve each sprite silhouette and keep transparent gaps", async ({
  page,
}) => {
  await page.goto("/?instance=validation-shadow-mask");
  const result = await page.evaluate(async () => {
    const path = "/src/game/building-shadow.ts";
    const { createBuildingShadow } = await import(/* @vite-ignore */ path);
    const source = document.createElement("canvas");
    source.width = source.height = 256;
    const context = source.getContext("2d")!;
    context.fillRect(40, 80, 80, 150);
    context.fillRect(70, 20, 20, 60); // Chimney above the body.
    const frame = { x: 0, y: 0, width: 256, height: 256 };
    const first = createBuildingShadow(source, frame) as HTMLCanvasElement;
    const alpha = (canvas: HTMLCanvasElement, x: number, y: number) =>
      canvas.getContext("2d")!.getImageData(x, y, 1, 1).data[3];
    const project = (x: number, y: number) => [
      Math.round(x + (230.4 - y) * 0.45),
      Math.round(230.4 + (230.4 - y) * 0.24),
    ];
    const sample = (canvas: HTMLCanvasElement, x: number, y: number) => {
      const [px, py] = project(x, y);
      return alpha(canvas, px, py);
    };
    context.clearRect(0, 0, 256, 256);
    context.fillRect(150, 80, 50, 150);
    const second = createBuildingShadow(source, frame) as HTMLCanvasElement;
    return {
      size: [first.width, first.height],
      body: sample(first, 80, 150),
      chimney: sample(first, 80, 40),
      gap: sample(first, 40, 40),
      differentSprite: sample(second, 80, 150),
      secondBody: sample(second, 175, 150),
    };
  });
  expect(result).toEqual({
    size: [384, 320],
    body: 255,
    chimney: 255,
    gap: 0,
    differentSprite: 0,
    secondBody: 255,
  });
});
