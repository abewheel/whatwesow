import { icon } from "./icons";

type Point = { x: number; y: number };
/** Presentation only: earned money is already saved before a reward starts. */
export class HarvestFeedback {
  private displayed: number;
  private target: number;
  private frame?: number;
  private effects = new Set<HTMLElement>();
  constructor(balance: number) {
    this.displayed = this.target = balance;
  }
  reserve(balance: number) {
    this.target = balance;
  }
  balance(balance: number) {
    if (balance !== this.target) this.reset(balance);
    return this.displayed;
  }
  reset(balance: number) {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.displayed = this.target = balance;
    for (const effect of this.effects) effect.remove();
    this.effects.clear();
  }
  private paint() {
    const counter = document.querySelector("#coin-count");
    if (counter) counter.textContent = this.displayed.toLocaleString();
  }
  private effect(className: string, origin: Point, markup = "") {
    const element = document.createElement("span");
    element.className = `harvest-feedback ${className}`;
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = markup;
    element.style.left = `${origin.x}px`;
    element.style.top = `${origin.y}px`;
    document.body.append(element);
    this.effects.add(element);
    return element;
  }
  private animate(
    element: HTMLElement,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const animation = element.animate(frames, { fill: "forwards", ...options });
    const remove = () => {
      element.remove();
      this.effects.delete(element);
    };
    void animation.finished.then(remove, remove);
  }
  award(origin: Point, amount: number) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const badge = this.effect(
      "harvest-reward",
      origin,
      `+${amount.toLocaleString()} ${icon("coin")}`,
    );
    this.animate(
      badge,
      reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: "translate(-50%, -22px) scale(.7)", opacity: 0 },
            {
              transform: "translate(-50%, -45px) scale(1.15)",
              opacity: 1,
              offset: 0.2,
            },
            {
              transform: "translate(-50%, -62px) scale(1)",
              opacity: 1,
              offset: 0.75,
            },
            { transform: "translate(-50%, -70px) scale(1)", opacity: 0 },
          ],
      { duration: reduced ? 450 : 1200, easing: "ease-out" },
    );
    if (!reduced) {
      const ring = this.effect("harvest-ring", origin);
      this.animate(
        ring,
        [
          { transform: "translate(-50%, -50%) scale(.4)", opacity: 0.9 },
          { transform: "translate(-50%, -50%) scale(1.8)", opacity: 0 },
        ],
        { duration: 500, easing: "ease-out" },
      );
      const hud = document
        .querySelector(".coin-balance .pixel-icon")
        ?.getBoundingClientRect();
      if (hud)
        for (
          let i = 0;
          i < Math.min(7, Math.max(3, Math.ceil(amount / 5)));
          i++
        ) {
          const coin = this.effect("harvest-coin", origin, icon("coin"));
          const dx = hud.x + hud.width / 2 - origin.x,
            dy = hud.y + hud.height / 2 - origin.y;
          this.animate(
            coin,
            [
              { transform: "translate(-50%, -50%) scale(.4)", opacity: 0 },
              {
                transform: `translate(${(i - 3) * 12}px, ${-50 - (i % 3) * 14}px) scale(1.1)`,
                opacity: 1,
                offset: 0.25,
              },
              {
                transform: `translate(${dx * 0.9 - 12}px, ${dy * 0.9 - 12}px) scale(.8)`,
                opacity: 1,
                offset: 0.85,
              },
              {
                transform: `translate(${dx - 12}px, ${dy - 12}px) scale(.6)`,
                opacity: 0,
              },
            ],
            {
              duration: 950,
              delay: i * 55,
              easing: "cubic-bezier(.25,.7,.5,1)",
            },
          );
        }
    }
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    if (reduced) {
      this.displayed = this.target;
      this.paint();
      return;
    }
    const from = this.displayed,
      to = this.target,
      start = performance.now() + 220;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / 1000));
      this.displayed = Math.floor(
        from + (to - from) * (1 - (1 - progress) ** 3),
      );
      this.paint();
      if (progress < 1) this.frame = requestAnimationFrame(tick);
      else {
        this.frame = undefined;
        document
          .querySelector(".coin-balance")
          ?.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.12)", color: "#a46512" },
              { transform: "scale(1)" },
            ],
            { duration: 260 },
          );
      }
    };
    this.frame = requestAnimationFrame(tick);
  }
}
