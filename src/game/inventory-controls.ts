import { icon } from "./icons";

type InventoryControls = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  count: () => number;
};

/** Inventory remains accessible beside the farm and camera controls. */
export function mountInventoryControls(controls: InventoryControls): {
  render: () => void;
} {
  const button = document.createElement("button");
  button.id = "open-inventory";
  button.type = "button";
  button.setAttribute("aria-keyshortcuts", "E I");
  button.innerHTML = `${icon("seeds")}<span class="sr-only">Inventory</span>`;
  document
    .querySelector(".corner-controls")!
    .insertBefore(button, document.querySelector("#open-shop"));

  const render = () => {
    const open = controls.isOpen();
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", `${open ? "Close" : "Open"} inventory`);
    button.title = `Inventory (E / I) · ${controls.count()} seeds`;
  };
  const toggle = () => {
    if (controls.isOpen()) controls.close();
    else controls.open();
    render();
  };
  button.addEventListener("click", toggle);
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !["e", "i"].includes(event.key.toLowerCase())
    )
      return;
    const target = event.target;
    if (
      (target instanceof Element &&
        target.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
        )) ||
      document.querySelector("dialog[open]") ||
      document.querySelector<HTMLElement>("#startup:not([hidden])")
    )
      return;
    event.preventDefault();
    toggle();
  });
  render();
  return { render };
}
