/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
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
        },
        surface: "#F4F4F4",
        "surface-dark": "#282828",
        muted: "#858585",
        border: "#DADADA",
      },
      fontFamily: {
        sans: ["Outfit-Regular"],
        body: ["Outfit-Regular"],
        heading: ["Manrope-Bold"],
        status: ["JosefinSans-SemiBold"],
      },
    },
  },
  plugins: [],
};
