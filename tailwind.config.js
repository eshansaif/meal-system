/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f6ff",
          100: "#dbe9fe",
          200: "#bcd7fe",
          300: "#8cbcfd",
          400: "#5598fa",
          500: "#3178f2",
          600: "#215be7",
          700: "#1c48d4",
          800: "#1d3cac",
          900: "#1c3587",
          950: "#152257"
        },
        ink: {
          50: "#f7f8fa",
          100: "#eceef2",
          200: "#d5d9e2",
          300: "#b0b8c6",
          400: "#8490a5",
          500: "#64708a",
          600: "#4f5972",
          700: "#41485d",
          800: "#393e4f",
          900: "#333744",
          950: "#20222b"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)",
        popover: "0 4px 6px -2px rgba(16,24,40,0.05), 0 10px 15px -3px rgba(16,24,40,0.1)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
};
