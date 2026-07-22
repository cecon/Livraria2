// Tailwind v4 no Next (ADR-0020). O PDV usa @tailwindcss/vite; aqui é o postcss.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
