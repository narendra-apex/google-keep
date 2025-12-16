import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary, #0066CC)",
        secondary: "var(--color-secondary, #FF9900)",
        accent: "var(--color-accent, #00AA44)",
        background: "var(--color-background, #FFFFFF)",
        text: "var(--color-text, #333333)",
        success: "var(--color-success, #00AA44)",
        warning: "var(--color-warning, #FFAA00)",
        error: "var(--color-error, #CC0000)",
      },
    },
  },
  plugins: [],
};

export default config;
