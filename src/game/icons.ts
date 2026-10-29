/** Isolated source crops keep neighboring atlas artwork out of controls. */
export type Icon =
  | "radish"
  | "tomato"
  | "pumpkin"
  | "turnip"
  | "carrot"
  | "corn"
  | "locked"
  | "duration"
  | "grow"
  | "sprout"
  | "expand"
  | "improve"
  | "coin"
  | "harvestValue"
  | "harvest"
  | "water"
  | "dryWater"
  | "withered"
  | "drought"
  | "weather"
  | "sun"
  | "spring"
  | "fall"
  | "winter"
  | "view"
  | "shop"
  | "menu"
  | "home"
  | "build"
  | "seeds"
  | "teardown"
  | "restart";
export function icon(name: Icon, className = ""): string {
  if (name === "harvestValue")
    return `<span class="harvest-value-icon" aria-hidden="true">${icon("harvest")}${icon("coin")}</span>`;
  const path = ["radish", "tomato", "pumpkin"].includes(name)
    ? `/art/${name}-icon.png`
    : `/art/icons/${name}.${["locked", "teardown", "restart", "duration", "water", "dryWater", "drought", "weather", "withered"].includes(name) ? "svg" : "png"}`;
  return `<span class="pixel-icon ${className}" aria-hidden="true" style="background-image:url('${path}')"></span>`;
}
