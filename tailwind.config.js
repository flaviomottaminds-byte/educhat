/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chatBg: '#0b141a',
        chatSidebar: '#111b21',
        chatPanel: '#202c33',
        chatBubbleUser: '#005c4b',
        chatBubbleOther: '#202c33',
        chatBorder: '#222e35',
        brand: {
          500: '#00a884',
          600: '#008069',
        }
      }
    },
  },
  plugins: [],
}
