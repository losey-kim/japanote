/* Japanote — first body script: hide main until first render + centered loader
 * (단어/한자/문법/독해/문자/홈 — 각 .html body 맨 앞, page-script-loader 첫 항목과 중복되면 2회째는 noop) */
(function () {
  if (typeof document === "undefined" || !document.body) {
    return;
  }

  document.documentElement.classList.add("japanote-app-booting");
  if (document.getElementById("japanote-boot-root")) {
    return;
  }

  const root = document.createElement("div");
  root.id = "japanote-boot-root";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", "불러오는 중");

  const scrim = document.createElement("div");
  scrim.className = "japanote-boot-scrim";
  scrim.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "japanote-boot-panel";

  const spinner = document.createElement("div");
  spinner.className = "japanote-boot-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const label = document.createElement("p");
  label.className = "japanote-boot-label";
  label.textContent = "불러오는 중";

  panel.appendChild(spinner);
  panel.appendChild(label);
  root.appendChild(scrim);
  root.appendChild(panel);
  document.body.appendChild(root);
})();