(function () {
    "use strict";

    const storageKey = "criczone-theme";

    function readTheme() {
        try {
            return localStorage.getItem(storageKey) === "light" ? "light" : "night";
        } catch (error) {
            return "night";
        }
    }

    let currentTheme = readTheme();

    function applyTheme(button, host) {
        document.documentElement.dataset.theme = currentTheme;

        if (host) {
            host.dataset.theme = currentTheme;
        }

        if (button) {
            const nextMode = currentTheme === "light" ? "night" : "light";
            button.textContent = currentTheme === "light" ? "☾" : "☼";
            button.title = `Switch to ${nextMode} mode`;
            button.setAttribute("aria-label", `Switch to ${nextMode} mode`);
            button.setAttribute("aria-pressed", String(currentTheme === "light"));
            button.style.setProperty("color", currentTheme === "light" ? "#20372a" : "#eaf5ee", "important");
            button.style.setProperty("background-color", currentTheme === "light" ? "#ffffff" : "#0e1c16", "important");
            button.style.setProperty("border", currentTheme === "light" ? "1px solid rgba(34, 89, 58, .24)" : "1px solid rgba(133, 170, 151, .35)", "important");
        }
    }

    function bind(button, host) {
        if (!button || button.dataset.themeBound === "true") {
            return;
        }

        button.dataset.themeBound = "true";
        applyTheme(button, host);
        button.addEventListener("click", () => {
            currentTheme = currentTheme === "light" ? "night" : "light";

            try {
                localStorage.setItem(storageKey, currentTheme);
            } catch (error) {}

            applyTheme(button, host);
        });
    }

    document.documentElement.dataset.theme = currentTheme;
    window.CriczoneTheme = { bind };

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".theme-toggle").forEach(button => bind(button));
    });
})();
