window.MathJax = {
  // MathJax enlarges math to match the font's x-height (about 1.23x for Inter), which makes inline math
  // look heavy next to the text. Scale it back down a bit.
  chtml: { scale: 0.9 },
  tex: {
    tags: "ams",
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
  },
  options: {
    renderActions: {
      addCss: [
        200,
        function (doc) {
          const style = document.createElement("style");
          style.innerHTML = `
          .mjx-container {
            color: inherit;
          }
        `;
          document.head.appendChild(style);
        },
        "",
      ],
    },
  },
};
