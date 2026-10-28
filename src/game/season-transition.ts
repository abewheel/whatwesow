import { icon } from "./icons";
import type { MacroState } from "../macro/state";

/** A presentation veil hides the seasonal redraw without changing turn rules. */
export class SeasonTransition {
  private element?: HTMLElement;
  private reduced = false;

  async cover({ season, year }: Pick<MacroState, "season" | "year">) {
    this.clear();
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const element = document.createElement("div");
    element.className = `season-transition season-transition-${season}`;
    element.setAttribute("role", "status");
    const confetti = '<i class="season-confetti"></i>'.repeat(6);
    element.innerHTML = `<div class="season-transition-card"><span class="season-transition-emblem" aria-hidden="true">${icon(season === "summer" ? "sun" : season)}${confetti}</span><small>Year ${year}</small><strong>${season}</strong></div>`;
    document.body.append(element);
    this.element = element;
    if (!this.reduced)
      await element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 220,
        fill: "forwards",
        easing: "ease-out",
      }).finished;
  }

  async reveal() {
    if (!this.element) return;
    const card = this.element.firstElementChild!;
    if (!this.reduced) {
      void card.querySelector(".pixel-icon")!.animate(
        [
          { transform: "translateY(6px) scale(0.8, 0.7) rotate(-10deg)" },
          {
            transform: "translateY(-10px) scale(1.12, 1.12) rotate(8deg)",
            offset: 0.4,
          },
          {
            transform: "translateY(2px) scale(1.05, 0.92) rotate(-4deg)",
            offset: 0.7,
          },
          { transform: "translateY(0) scale(1) rotate(0deg)" },
        ],
        { duration: 560, easing: "ease-out" },
      );
      card.querySelectorAll(".season-confetti").forEach((piece, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 44;
        const y = Math.sin(angle) * 34;
        void piece.animate(
          [
            { opacity: 0, transform: "translate(0, 0) scale(0)" },
            {
              opacity: 1,
              transform: `translate(${x}px, ${y}px) rotate(45deg) scale(1)`,
              offset: 0.45,
            },
            {
              opacity: 0,
              transform: `translate(${x * 1.25}px, ${y + 12}px) rotate(100deg) scale(0.5)`,
            },
          ],
          { duration: 600, easing: "ease-out", fill: "both" },
        );
      });
    }
    await this.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: this.reduced ? 350 : 450,
      duration: this.reduced ? 0 : 400,
      fill: "forwards",
    }).finished;
  }

  clear() {
    this.element?.remove();
    this.element = undefined;
  }
}
