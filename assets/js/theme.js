const themeStorageKey = "japanote-theme";
const themeModes = ["system", "light", "dark"];

function getSavedThemeMode() {
  const saved = localStorage.getItem(themeStorageKey);
  return themeModes.includes(saved) ? saved : "system";
}

function applyThemeMode(mode) {
  const root = document.documentElement;
  const nextMode = themeModes.includes(mode) ? mode : "system";

  if (nextMode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", nextMode);
  }

  root.setAttribute("data-theme-mode", nextMode);
  updateThemeToggleLabel(nextMode);
}

function updateThemeToggleLabel(mode = getSavedThemeMode()) {
  const labelMap = {
    system: "테마는 기기에 맞출게요",
    light: "밝게 볼까요?",
    dark: "차분하게 볼까요?"
  };

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = "";
    button.dataset.themeMode = mode;
    button.setAttribute("aria-label", labelMap[mode]);
    button.setAttribute("title", labelMap[mode]);
  });
}

function cycleThemeMode() {
  const current = getSavedThemeMode();
  const currentIndex = themeModes.indexOf(current);
  const nextMode = themeModes[(currentIndex + 1) % themeModes.length];

  localStorage.setItem(themeStorageKey, nextMode);
  applyThemeMode(nextMode);
}

function initializeTheme() {
  applyThemeMode(getSavedThemeMode());

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", cycleThemeMode);
  });
}

initializeTheme();
