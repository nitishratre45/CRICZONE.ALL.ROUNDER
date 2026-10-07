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
            button.textContent = currentTheme === "light" ? "\u263E" : "\u2600";
            button.title = `Switch to ${nextMode} mode`;
            button.setAttribute("aria-label", `Switch to ${nextMode} mode`);
            button.setAttribute("aria-pressed", String(currentTheme === "light"));
            button.style.setProperty("color", currentTheme === "light" ? "#20372a" : "#eaf5ee", "important");
            button.style.setProperty("background-color", currentTheme === "light" ? "#ffffff" : "#0e1c16", "important");
            button.style.setProperty("border", currentTheme === "light" ? "1px solid rgba(34, 89, 58, .24)" : "1px solid rgba(133, 170, 151, .35)", "important");
            button.style.setProperty("width", "42px", "important");
            button.style.setProperty("height", "42px", "important");
            button.style.setProperty("border-radius", "12px", "important");
            button.style.setProperty("display", "inline-grid", "important");
            button.style.setProperty("place-items", "center", "important");
            button.style.setProperty("font-size", "18px", "important");
            button.style.setProperty("font-weight", "800", "important");
            button.style.setProperty("cursor", "pointer", "important");
            button.style.setProperty("box-shadow", currentTheme === "light" ? "0 8px 24px rgba(34,89,58,.12)" : "0 8px 28px rgba(0,0,0,.28)", "important");
            button.style.setProperty("transition", "transform .18s ease, box-shadow .22s ease, background-color .25s ease, color .25s ease", "important");
            button.onmouseenter = () => {
                button.style.transform = "translateY(-2px) rotate(3deg)";
            };
            button.onmouseleave = () => {
                button.style.transform = "translateY(0) rotate(0)";
            };
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

    function bindAll(scope) {
        (scope || document).querySelectorAll(".theme-toggle").forEach(button => bind(button));
    }

    function observe() {
        if (!window.MutationObserver || !document.body) {
            return;
        }

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (!node || node.nodeType !== 1) {
                        return;
                    }

                    if (node.classList && node.classList.contains("theme-toggle")) {
                        bind(node);
                    }

                    if (node.querySelectorAll) {
                        node.querySelectorAll(".theme-toggle").forEach(button => bind(button));
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    document.documentElement.dataset.theme = currentTheme;
    window.CriczoneTheme = { bind, bindAll };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            bindAll(document);
            observe();
        });
    } else {
        bindAll(document);
        observe();
    }
})();