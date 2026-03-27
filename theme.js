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
    system: "테마: 시스템",
    light: "테마: 라이트",
    dark: "테마: 다크"
  };

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = labelMap[mode];
    button.setAttribute("aria-label", `현재 테마 ${labelMap[mode]}`);
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
