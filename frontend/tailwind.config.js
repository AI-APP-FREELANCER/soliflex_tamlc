/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        soliflex: {
          orange: {
            50: "#FFF4EE",
            100: "#FFE4D3",
            200: "#FFC6A3",
            300: "#FFA066",
            400: "#FA7B3A",
            500: "#F26522",
            600: "#DD5216",
            700: "#B84212",
            800: "#933713",
            900: "#772F13",
          },
          brick: {
            50: "#FBEEEC",
            100: "#F3D3CD",
            200: "#E4A99C",
            300: "#CE7A67",
            400: "#B85643",
            500: "#A6392B",
            600: "#8E2E22",
            700: "#73271D",
            800: "#5D211A",
            900: "#4C1C17",
          },
          ink: "#23272B",
          gray: {
            50: "#F7F7F8",
            100: "#EEEEF0",
            200: "#DDDEE2",
            300: "#C2C4CA",
            400: "#9A9DA6",
            500: "#797D87",
            600: "#5D616B",
            700: "#494C54",
            800: "#34363B",
            900: "#212226",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(35,39,43,0.06), 0 1px 3px 0 rgba(35,39,43,0.08)",
        popover: "0 8px 24px rgba(35,39,43,0.16)",
      },
    },
  },
  plugins: [],
};
