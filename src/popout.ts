// The little panels that open over a page (the help, the room switcher,
// the room's settings): Esc closes whichever is open and puts you back on
// the button that opened it, and a click anywhere else closes it, as a menu
// does. They're <details>, so they work without this too; this is what
// makes them behave like the pop-outs they look like.
const POPOUTS = "details.help, details.room-switch, details.room-settings";

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = [...document.querySelectorAll<HTMLDetailsElement>(`:is(${POPOUTS})[open]`)];
  if (!open.length) return;
  // (the one you're in, if you're in one; otherwise all of them)
  const inside = open.find((d) => d.contains(document.activeElement));
  for (const d of inside ? [inside] : open) d.open = false;
  (inside ?? open[0]).querySelector<HTMLElement>("summary")?.focus();
  // (Esc that closed a panel isn't also the room's, or full screen's)
  e.stopPropagation();
}, true);

document.addEventListener("click", (e) => {
  for (const d of document.querySelectorAll<HTMLDetailsElement>(`:is(${POPOUTS})[open]`)) if (!d.contains(e.target as Node)) d.open = false;
});
