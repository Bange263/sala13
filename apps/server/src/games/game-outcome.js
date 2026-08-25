function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function membersForTeams(state, teamIds) {
  return unique(teamIds.flatMap((teamId) => state.teams?.[teamId] ?? (teamId ? [teamId] : [])));
}

function namesFor(players, ids) {
  const names = ids.map((id) => players.find((player) => player.id === id)?.name ?? "Giocatore");
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

function blackjackWinners(state) {
  return state.order.filter((id) => state.playerStates[id].hands.some((hand) => ["win", "blackjack"].includes(hand.result)));
}

export function deriveGameOutcome(gameId, state, players) {
  let winnerIds = [];
  let isDraw = false;
  let detail = "La partita è terminata.";

  if (gameId === "blackjack") {
    winnerIds = blackjackWinners(state);
    detail = winnerIds.length ? "Una o più mani hanno battuto il banco." : "Il banco ha vinto questo round.";
  } else if (["scopa", "briscola"].includes(gameId)) {
    winnerIds = membersForTeams(state, state.winnerTeams ?? []);
    isDraw = (state.winnerTeams?.length ?? 0) > 1;
    detail = gameId === "scopa" ? "Conteggio di Carte, Denari, Settebello, Primiera e Scope completato." : "Tutte le prese e i 120 punti sono stati conteggiati.";
  } else if (gameId === "burraco") {
    winnerIds = membersForTeams(state, state.winnerTeam ? [state.winnerTeam] : []);
    isDraw = winnerIds.length === 0;
    detail = "Pozzetto, burraco e carte residue sono stati conteggiati.";
  } else if (Array.isArray(state.winnerIds)) {
    winnerIds = unique(state.winnerIds);
    isDraw = winnerIds.length > 1;
  } else if (state.winnerId) {
    winnerIds = [state.winnerId];
  } else if (state.draw || String(state.result ?? "").includes("draw") || state.result === "stalemate") {
    isDraw = true;
  }

  if (gameId === "hangman" && !state.winnerId) {
    detail = `La parola era “${state.solution}”.`;
  }
  if (gameId === "draw-and-pass" && state.mode === "pass") {
    detail = "Tutte le catene disegno-testo sono pronte da sfogliare.";
  }

  const title = isDraw
    ? "La partita finisce in pareggio"
    : winnerIds.length > 0
      ? `${namesFor(players, winnerIds)} ${winnerIds.length > 1 ? "vincono" : "ha vinto"} la partita!`
      : gameId === "blackjack"
        ? "Il banco ha vinto il round"
        : "Partita conclusa";

  return {
    title,
    detail,
    winnerIds,
    isDraw,
    finishedAt: Date.now()
  };
}
