const THEME_KEY = "dsa-viz-theme";
const saved = localStorage.getItem(THEME_KEY);
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initial = saved || (prefersDark ? "dark" : "light");
document.documentElement.setAttribute("data-theme", initial);

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const update = (t) => {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem(THEME_KEY, t);
        btn.textContent = t === "dark" ? "☀️" : "🌙";
    };
    update(initial);
    btn.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme");
        update(cur === "dark" ? "light" : "dark");
    });
});
