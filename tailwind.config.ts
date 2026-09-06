import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 단일 포인트 컬러. 강조는 전부 이 색 하나로만 준다.
        accent: {
          50: "#eff5ff",
          100: "#dbe8fe",
          200: "#bfd6fe",
          500: "#3b76f6",
          600: "#1f57e8",
          700: "#1a44c4",
          900: "#1b2f70",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
