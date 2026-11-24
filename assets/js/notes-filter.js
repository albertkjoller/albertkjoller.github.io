// Notes page (_pages/blog.md): filter the note cards by topic (category) and level.
// One choice per group, groups combine (topic AND level). The choice is kept in the URL
// (?topic=geometry&level=technical), so a filtered view can be linked to.
(function () {
  "use strict";

  const params = { category: "topic", level: "level" };

  function init() {
    const groups = Array.from(document.querySelectorAll(".notes-filter-group"));
    if (!groups.length) return;
    const cards = Array.from(document.querySelectorAll(".note-card"));
    const empty = document.querySelector(".notes-empty");
    const state = {};

    const url = new URL(window.location.href);
    groups.forEach((g) => {
      const key = g.dataset.filter;
      const fromUrl = url.searchParams.get(params[key]) || "";
      const valid = Array.from(g.querySelectorAll(".notes-chip")).some((c) => c.dataset.value === fromUrl);
      state[key] = valid ? fromUrl : "";
    });

    function apply() {
      let shown = 0;
      cards.forEach((card) => {
        const ok = Object.keys(state).every((key) => {
          const want = state[key];
          if (!want) return true;
          return (card.dataset[key] || "").split(/\s+/).includes(want);
        });
        card.hidden = !ok;
        if (ok) shown++;
      });

      // Hide a section (pinned / all notes) and its label when none of its cards are left
      document.querySelectorAll(".notes-grid").forEach((grid) => {
        const visible = Array.from(grid.querySelectorAll(".note-card")).some((c) => !c.hidden);
        grid.hidden = !visible;
        const label = grid.previousElementSibling;
        if (label && /notes-(pinned|section)-label/.test(label.className)) label.hidden = !visible;
      });
      if (empty) empty.hidden = shown > 0;

      groups.forEach((g) => {
        g.querySelectorAll(".notes-chip").forEach((chip) => {
          const on = chip.dataset.value === state[g.dataset.filter];
          chip.classList.toggle("is-active", on);
          chip.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });

      const u = new URL(window.location.href);
      Object.keys(state).forEach((key) => {
        if (state[key]) u.searchParams.set(params[key], state[key]);
        else u.searchParams.delete(params[key]);
      });
      history.replaceState(null, "", u);
    }

    groups.forEach((g) => {
      g.addEventListener("click", (e) => {
        const chip = e.target.closest(".notes-chip");
        if (!chip) return;
        const key = g.dataset.filter;
        // Clicking the active chip again goes back to "all"
        state[key] = state[key] === chip.dataset.value ? "" : chip.dataset.value;
        apply();
      });
    });

    // The topic pills on each card set the topic filter too
    document.querySelectorAll(".note-card .note-category[data-value]").forEach((pill) => {
      pill.addEventListener("click", () => {
        if (!("category" in state)) return;
        state.category = pill.dataset.value;
        apply();
        const bar = document.querySelector(".notes-filters");
        if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    apply();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
