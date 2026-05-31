/**
 * Shared tab-bar geometry used by all bottom-tab layouts (buyer, vendor,
 * admin). Screens import these to compute correct bottom content padding
 * so list/scroll content never gets hidden behind the floating pill.
 */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 14;

/** Total vertical room a screen should reserve at the bottom of its scroll. */
export const TAB_BAR_RESERVED_SPACE = TAB_BAR_HEIGHT + TAB_BAR_GAP;
