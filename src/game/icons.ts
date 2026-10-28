/** Isolated source crops keep neighboring atlas artwork out of controls. */
export type Icon =
  | "radish"
  | "tomato"
  | "pumpkin"
  | "turnip"
  | "carrot"
  | "corn"
  | "grow"
  | "expand"
  | "improve"
  | "coin"
  | "harvest"
  | "sun"
  | "spring"
  | "fall"
  | "winter"
  | "view"
  | "menu"
  | "home"
  | "build"
  | "seeds";
export function icon(name: Icon, className = "") {
  const path = ["radish", "tomato", "pumpkin"].includes(name)
    ? `/art/${name}-icon.png`
    : `/art/icons/${name}.png`;
  return `<span class="pixel-icon ${className}" aria-hidden="true" style="background-image:url('${path}')"></span>`;
}
