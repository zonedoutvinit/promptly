module.exports = {
  theme: {
    extend: {
      keyframes: {
        textPulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeInScale: {
          "0%": { opacity: 0, transform: "scale(0.95)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        cursorPulse: "textPulse 1s ease-in-out infinite",
        messageSlide: "slideUp 0.2s ease-out forwards",
        chipFade: "fadeInScale 0.15s ease-out forwards",
      },
    },
  },
};
