/** Whether shortcuts should show the Command key; the browser has no `process.platform`. */
export const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

export const MOD_KEY_LABEL = isMac ? "⌘" : "Ctrl";
