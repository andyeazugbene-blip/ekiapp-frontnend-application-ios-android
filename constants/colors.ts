export const Colors = {
  primary: {
    DEFAULT: "#076B51",
    50: "#EAF6F2",
    100: "#D7F1E9",
    200: "#A8DACB",
    300: "#79C3AD",
    400: "#3F967C",
    500: "#076B51",
    600: "#055944",
    700: "#044637",
    800: "#033529",
    900: "#02241C",
  },
  teal: {
    DEFAULT: "#076B51",
    light: "#3F967C",
    dark: "#044637",
  },
  dark: {
    card: "#282828",
    bg: "#282828",
    header: "#076B51",
  },
  surface: "#F4F4F4",
  surfaceAlt: "#FFFFFF",
  border: "#DADADA",
  muted: "#858585",
  mutedLight: "#A7A7A7",

  text: {
    primary: "#282828",
    secondary: "#858585",
    muted: "#A7A7A7",
    inverse: "#FFFFFF",
    onDark: "#FFFFFF",
  },

  status: {
    success: "#076B51",
    successBg: "rgba(7,107,81,0.10)",
    warning: "#FFC500",
    warningBg: "rgba(255,197,0,0.16)",
    error: "#FB6363",
    errorBg: "rgba(251,99,99,0.14)",
    info: "#076B51",
    infoBg: "rgba(7,107,81,0.10)",
    pending: "#FFC500",
    pendingBg: "rgba(255,197,0,0.16)",
    active: "#076B51",
    activeBg: "rgba(7,107,81,0.10)",
    suspended: "#FB6363",
    suspendedBg: "rgba(251,99,99,0.14)",
    draft: "#858585",
    draftBg: "#F4F4F4",
  },

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",

  overlay: "rgba(40,40,40,0.48)",
  shadowColor: "rgba(40,40,40,0.10)",
};

export type ColorKeys = keyof typeof Colors;
