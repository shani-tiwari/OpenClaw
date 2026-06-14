const loaderEl = document.getElementById("loader");

function buildLoader(label = "OpenClaw is working") {
  loaderEl.innerHTML = `
    <div class="claw-ring"></div>
    <div class="claw-ring"></div>
    <div class="claw-ring"></div>
    <div class="claw-core">🦞</div>
    <div class="loader-label"><span class="loader-dots">${label}</span></div>
  `;
}

function setLabel(text) {
  const label = loaderEl.querySelector(".loader-dots");
  if (label) label.textContent = text;
}

buildLoader();

window.OpenClawLoader = { buildLoader, setLabel };
