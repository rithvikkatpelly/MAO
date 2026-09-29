export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";

export function isMod(e) {
  return IS_MAC ? e.metaKey : e.ctrlKey;
}

export function isTyping(e) {
  return !!e.target.closest?.("input, textarea, select, [contenteditable='true']");
}
