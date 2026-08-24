import { renderExample } from "./examples.js";

export function createInfoModal(games) {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const dialog = document.querySelector("#info-dialog");
  const title = document.querySelector("#info-title");
  const tag = document.querySelector("#info-tag");
  const description = document.querySelector("#info-description");
  const example = document.querySelector("#info-example");
  const body = document.querySelector("#info-body");
  const quickTab = document.querySelector("#quick-tab");
  const deepTab = document.querySelector("#deep-tab");
  let activeGame = null;
  let mode = "quick";

  function renderRules() {
    body.replaceChildren();
    quickTab.setAttribute("aria-selected", String(mode === "quick"));
    deepTab.setAttribute("aria-selected", String(mode === "deep"));
    if (!activeGame) return;

    if (mode === "quick") {
      const list = document.createElement("ol");
      for (const rule of activeGame.rules.quick) {
        const item = document.createElement("li");
        item.textContent = rule;
        list.append(item);
      }
      body.append(list);
      return;
    }

    for (const section of activeGame.rules.deep) {
      const wrapper = document.createElement("section");
      wrapper.className = "info-detail";
      const heading = document.createElement("h3");
      heading.textContent = section.title;
      const paragraph = document.createElement("p");
      paragraph.textContent = section.body;
      wrapper.append(heading, paragraph);
      body.append(wrapper);
    }
  }

  function open(gameId) {
    activeGame = gameById.get(gameId);
    if (!activeGame) return;
    mode = "quick";
    title.textContent = activeGame.name;
    tag.textContent = `${activeGame.tag} · ${activeGame.players.label} giocatori`;
    description.textContent = activeGame.description;
    example.replaceChildren(renderExample(activeGame.example));
    renderRules();
    dialog.showModal();
  }

  quickTab.addEventListener("click", () => {
    mode = "quick";
    renderRules();
  });
  deepTab.addEventListener("click", () => {
    mode = "deep";
    renderRules();
  });
  document.querySelector("#close-info-button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return { open };
}
