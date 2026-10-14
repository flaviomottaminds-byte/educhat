/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chatBg: 'var(--bg-chatBg)',
        chatSidebar: 'var(--bg-chatSidebar)',
        chatPanel: 'var(--bg-chatPanel)',
        chatCard: 'var(--bg-chatCard)',
        chatBubbleUser: 'var(--bg-chatBubbleUser)',
        chatBubbleUserText: 'var(--text-chatBubbleUser)',
        chatBubbleOther: 'var(--bg-chatBubbleOther)',
        chatBubbleOtherText: 'var(--text-chatBubbleOther)',
        chatBorder: 'var(--border-chatBorder)',
        chatTextTitle: 'var(--text-title)',
        chatTextBody: 'var(--text-body)',
        chatTextMuted: 'var(--text-muted)',
        chatInputBg: 'var(--input-bg)',
        chatBoxSecondary: 'var(--box-secondary)',
        brand: {
          500: '#00a884',
          600: '#008069',
          700: '#005c4b',
        }
      }
    },
  },
  plugins: [],
}
