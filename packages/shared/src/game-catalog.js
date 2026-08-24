const detail = (title, body) => ({ title, body });

export const GAME_CATALOG = Object.freeze([
  {
    id: "blackjack",
    name: "Blackjack",
    tag: "Carte",
    description: "Tavolo cooperativo-competitivo contro il banco, con puntate e decisioni simultanee.",
    players: { min: 2, max: 7, label: "2–7" },
    implementation: "blueprint",
    accent: "#a64b35",
    rules: {
      quick: [
        "Ogni giocatore sfida il banco, non gli altri partecipanti.",
        "Avvicinati a 21 senza superarlo; figure valgono 10 e l'asso 1 oppure 11.",
        "Il banco pesca fino a 17; blackjack naturale paga secondo le impostazioni del tavolo."
      ],
      deep: [
        detail("Turno", "Puntata, distribuzione di due carte, azioni del giocatore e infine turno del banco. Hit pesca, Stand si ferma, Double raddoppia e riceve una sola carta."),
        detail("Split", "Con due carte dello stesso valore si possono creare due mani. Il server conserva separatamente puntate, carte, stato e risultato di ciascuna mano."),
        detail("Regole configurabili", "Soft 17, payout 3:2 o 6:5, numero di mazzi, assicurazione e limiti di puntata devono essere fissati prima dell'avvio e mostrati nell'Info.")
      ]
    },
    example: { type: "blackjack", title: "Esempio: blackjack naturale" }
  },
  {
    id: "uno",
    name: "Uno",
    tag: "Carte",
    description: "Partite rapide con colori, carte azione e regole di accumulo configurabili.",
    players: { min: 2, max: 10, label: "2–10" },
    implementation: "blueprint",
    accent: "#c33b2f",
    rules: {
      quick: [
        "Gioca una carta con lo stesso colore, numero o simbolo della carta in tavola.",
        "Salta, Inverti, +2, Jolly e +4 modificano il turno o il colore corrente.",
        "Vince chi termina le carte; la chiamata Uno e le penalità sono validate dal server."
      ],
      deep: [
        detail("Accumulo", "Lo stacking di +2/+4 non è una regola universale: Sala13 lo tratta come opzione della stanza e indica chiaramente quali combinazioni sono ammesse."),
        detail("Jolly +4", "Il server sa quali colori possiede il giocatore e può verificare se il +4 è legale, senza rivelare la mano agli avversari."),
        detail("Fine manche", "Il punteggio può essere disattivato, calcolato sulle carte rimaste oppure accumulato su più manche fino a una soglia.")
      ]
    },
    example: { type: "uno", title: "Esempio: cambio colore" }
  },
  {
    id: "scopa",
    name: "Scopa",
    tag: "Carte napoletane",
    description: "La tradizione italiana con prese, scope, Primiera, Settebello, Denari e Carte.",
    players: { min: 2, max: 4, label: "2 o 4", allowed: [2, 4] },
    implementation: "blueprint",
    accent: "#b9782c",
    rules: {
      quick: [
        "Si usa un mazzo italiano da 40 carte; a quattro si gioca a coppie.",
        "Una carta prende lo stesso valore oppure una combinazione in tavola con quella somma.",
        "L'ultima presa raccoglie le carte residue ma non vale come scopa."
      ],
      deep: [
        detail("Presa obbligata", "Se sul tavolo esiste una carta dello stesso valore di quella giocata, va presa quella: non si può scegliere una somma alternativa."),
        detail("Punti di mano", "Un punto per più Carte, più Denari, Settebello e Primiera; ogni scopa aggiunge un punto. Le parità non assegnano il punto di maggioranza."),
        detail("Primiera", "Per ciascun seme conta la carta migliore: 7=21, 6=18, Asso=16, 5=15, 4=14, 3=13, 2=12, figure=10. Servono tutti e quattro i semi.")
      ]
    },
    example: { type: "scopa", title: "Esempio: presa per somma" }
  },
  {
    id: "briscola",
    name: "Briscola",
    tag: "Carte napoletane",
    description: "Prese tattiche con seme di briscola, ordine speciale delle carte e 120 punti totali.",
    players: { min: 2, max: 4, label: "2 o 4", allowed: [2, 4] },
    implementation: "blueprint",
    accent: "#6b7f39",
    rules: {
      quick: [
        "La carta scoperta sotto al mazzo determina il seme di briscola.",
        "Vince la presa la briscola più alta, altrimenti la carta più alta del seme d'uscita.",
        "Valori: Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2; le altre valgono zero."
      ],
      deep: [
        detail("Ordine", "Dalla più forte: Asso, Tre, Re, Cavallo, Fante, 7, 6, 5, 4, 2. Non è obbligatorio rispondere al seme."),
        detail("Pesca", "Chi vince la presa pesca per primo. La carta che indica la briscola è l'ultima carta pescata."),
        detail("Vittoria", "Ci sono 120 punti: 61 vince, 60–60 pareggia. A quattro i punti appartengono alla coppia, con compagni alternati al tavolo.")
      ]
    },
    example: { type: "briscola", title: "Esempio: la briscola supera il seme" }
  },
  {
    id: "texas-holdem",
    name: "Texas Hold'em",
    tag: "Poker",
    description: "Tavolo a chip con bui, quattro giri di puntate e valutazione completa delle mani.",
    players: { min: 2, max: 10, label: "2–10" },
    implementation: "blueprint",
    accent: "#315b4a",
    rules: {
      quick: [
        "Ogni giocatore riceve due carte private e condivide cinque carte comuni.",
        "I giri sono Pre-flop, Flop, Turn e River, con Fold, Check, Call, Bet e Raise.",
        "La migliore combinazione di cinque carte determina il piatto."
      ],
      deep: [
        detail("Bui e turni", "Small blind e big blind ruotano con il dealer button. Il server mantiene giocatore attivo, puntata da chiamare, minimum raise e stack residui."),
        detail("All-in", "Puntate diverse creano main pot e side pot. Ogni piatto include solo i giocatori che vi hanno contribuito e ancora contendono la mano."),
        detail("Showdown", "Il valutatore confronta categoria e kicker: scala reale, scala colore, poker, full, colore, scala, tris, doppia coppia, coppia, carta alta.")
      ]
    },
    example: { type: "poker", title: "Esempio: full house" }
  },
  {
    id: "burraco",
    name: "Burraco",
    tag: "Carte",
    description: "Scale, gruppi, pozzetto e burraco pulito o sporco in partite a coppie o individuali.",
    players: { min: 2, max: 4, label: "2–4" },
    implementation: "blueprint",
    accent: "#7c5941",
    rules: {
      quick: [
        "Pesca dal tallone oppure raccogli il monte scarti, poi apri o allunga combinazioni e scarta.",
        "Per chiudere bisogna prendere il pozzetto e avere almeno un burraco.",
        "Una sequenza di almeno sette carte è un burraco; pulito senza matta, sporco con matta."
      ],
      deep: [
        detail("Combinazioni", "Sono ammessi gruppi dello stesso valore o scale dello stesso seme. Pinelle e jolly sono matte, soggette ai limiti scelti per il tavolo."),
        detail("Pozzetto", "Ogni squadra ha un mazzetto di riserva. Può essere preso al volo terminando le carte con una combinazione, oppure dopo lo scarto nel turno successivo."),
        detail("Punteggio", "Bonus di chiusura e burraco si sommano alle carte calate; le carte rimaste in mano e un pozzetto non preso vengono sottratti.")
      ]
    },
    example: { type: "burraco", title: "Esempio: burraco pulito" }
  },
  {
    id: "battleship",
    name: "Battaglia Navale",
    tag: "Strategia",
    description: "Piazzamento segreto, fuoco alternato e riscontro immediato di acqua, colpito e affondato.",
    players: { min: 2, max: 2, label: "2" },
    implementation: "blueprint",
    accent: "#406b72",
    rules: {
      quick: [
        "Ogni giocatore dispone la flotta sulla propria griglia senza sovrapposizioni.",
        "A turno si spara su una coordinata non ancora scelta della griglia avversaria.",
        "Vince chi affonda tutte le navi avversarie."
      ],
      deep: [
        detail("Segretezza", "Il server valida il piazzamento e invia all'avversario soltanto esiti e celle già rivelate, mai la griglia completa."),
        detail("Regole flotta", "Dimensioni della griglia, elenco navi, contatto consentito o vietato e colpo extra dopo un centro sono impostazioni bloccate all'avvio."),
        detail("Disconnessioni", "Una pausa con finestra di rientro evita vittorie accidentali. Alla scadenza il tavolo applica resa o annullamento secondo la configurazione.")
      ]
    },
    example: { type: "battleship", title: "Esempio: acqua e colpito" }
  },
  {
    id: "chess-checkers",
    name: "Scacchi / Dama",
    tag: "Scacchiera",
    description: "Due motori separati sulla stessa scacchiera, con mosse validate e gestione di vittoria o patta.",
    players: { min: 2, max: 2, label: "2" },
    implementation: "blueprint",
    accent: "#4f5147",
    rules: {
      quick: [
        "L'host sceglie Scacchi oppure Dama italiana prima dell'avvio.",
        "Il server accetta solo mosse legali del giocatore di turno.",
        "Scacco matto, stallo, ripetizioni o assenza di pezzi/mosse terminano la partita."
      ],
      deep: [
        detail("Scacchi", "Vanno gestiti arrocco, en passant, promozione, scacco, matto, stallo, regola delle cinquanta mosse e triplice ripetizione."),
        detail("Dama italiana", "Pedine sulle case scure, presa obbligatoria e promozione a dama. Le priorità tra prese multiple devono seguire la variante dichiarata."),
        detail("Registro mosse", "Ogni mossa incrementa la versione dello stato e viene registrata; per gli scacchi è utile esportare anche la notazione FEN/PGN.")
      ]
    },
    example: { type: "chess", title: "Esempio: scacchiera e mossa valida" }
  },
  {
    id: "tic-tac-toe",
    name: "Tris",
    tag: "Test rapido",
    description: "Una griglia 3×3 completa e già giocabile, ideale per verificare lobby e sincronizzazione.",
    players: { min: 2, max: 2, label: "2" },
    implementation: "playable",
    accent: "#c35f3f",
    rules: {
      quick: [
        "Due giocatori alternano X e O su una griglia 3×3.",
        "Una casella occupata non può essere selezionata di nuovo.",
        "Tre simboli in riga, colonna o diagonale vincono; griglia piena senza linea significa pareggio."
      ],
      deep: [
        detail("Autorità del server", "Il browser invia soltanto l'indice della casella. Turno, disponibilità, vittoria e pareggio sono calcolati sul server."),
        detail("Versione stato", "Ogni azione contiene la versione vista dal client. Una mossa vecchia o duplicata viene rifiutata e il client riceve lo stato corrente."),
        detail("Rivincita", "Dopo la fine entrambi tornano non pronti; quando confermano di nuovo, l'host può avviare una nuova partita nella stessa stanza.")
      ]
    },
    example: { type: "tic-tac-toe", title: "Esempio: tre in diagonale" }
  },
  {
    id: "categories",
    name: "Nomi, Cose, Città",
    tag: "Parole",
    description: "Categorie selezionabili, lettera globale, timer condiviso e validazione a voto.",
    players: { min: 2, max: 20, label: "2–20" },
    implementation: "blueprint",
    accent: "#9a6b27",
    rules: {
      quick: [
        "Una lettera estratta e un timer sono uguali per tutti i partecipanti.",
        "Ogni risposta deve iniziare con la lettera e appartenere alla categoria.",
        "A fine round le risposte vengono rivelate e accettate o respinte tramite voto."
      ],
      deep: [
        detail("Categorie", "Il catalogo predefinito include classiche, cultura, scuola, sport, cibo e fantasia. L'host può selezionarle o aggiungerne prima del via."),
        detail("Punteggio", "Configurazione tipica: 10 punti risposta valida unica, 5 se condivisa, 0 se vuota o respinta. Soglia voto e astensione sono configurabili."),
        detail("Tempo affidabile", "Il server comunica timestamp di inizio/fine; i client visualizzano il conto alla rovescia ma il server decide se una consegna è in tempo.")
      ]
    },
    example: { type: "categories", title: "Esempio: lettera e categorie" }
  },
  {
    id: "hangman",
    name: "L'Impiccato",
    tag: "Parole",
    description: "Parole nascoste, lettere condivise e disegno SVG aggiornato a ogni errore.",
    players: { min: 2, max: 12, label: "2–12" },
    implementation: "blueprint",
    accent: "#6e5849",
    rules: {
      quick: [
        "Il suggeritore sceglie una parola o il server la estrae da un dizionario.",
        "Le lettere corrette vengono scoperte ovunque; un errore aggiunge una parte al disegno.",
        "La squadra vince completando la parola prima del limite di errori."
      ],
      deep: [
        detail("Privacy parola", "La soluzione resta solo sul server e, se presente, sul client del suggeritore. Agli altri arriva una maschera con gli indici rivelati."),
        detail("Accenti", "La normalizzazione può ignorare maiuscole e accenti per il confronto, conservando però la grafia originale nella rivelazione finale."),
        detail("Modalità", "Cooperativa, a turni o squadre; dizionari e parole personalizzate devono essere filtrati in base al contesto scolastico.")
      ]
    },
    example: { type: "hangman", title: "Esempio: disegno a quattro errori" }
  },
  {
    id: "connect-four",
    name: "Forza Quattro",
    tag: "Strategia",
    description: "Gettoni con gravità su griglia 7×6 e rilevamento delle linee in quattro direzioni.",
    players: { min: 2, max: 2, label: "2" },
    implementation: "blueprint",
    accent: "#bd6f2f",
    rules: {
      quick: [
        "Scegli una colonna: il gettone cade nella prima cella libera dal basso.",
        "I giocatori alternano il proprio colore; le colonne piene non sono valide.",
        "Quattro gettoni consecutivi in orizzontale, verticale o diagonale vincono."
      ],
      deep: [
        detail("Controllo linea", "Dopo ogni mossa basta contare dal nuovo gettone nelle coppie di direzioni orizzontale, verticale e diagonali."),
        detail("Pareggio", "Se tutte le 42 celle sono occupate senza una linea valida, la partita termina in parità."),
        detail("Animazione", "La caduta è solo presentazione client; la colonna e la riga definitive sono sempre restituite dal server.")
      ]
    },
    example: { type: "connect-four", title: "Esempio: quattro in diagonale" }
  },
  {
    id: "draw-and-pass",
    name: "Disegna & Passa",
    tag: "Disegno",
    description: "Canvas condivisa a turni, prompt segreti e catene disegno-testo in stile telefono senza fili.",
    players: { min: 2, max: 12, label: "2–12" },
    implementation: "blueprint",
    accent: "#42705b",
    rules: {
      quick: [
        "Modalità Disegno: un giocatore disegna la parola segreta mentre gli altri provano a indovinarla.",
        "Modalità Passa: ogni prompt alterna testo e disegno, poi l'intera catena viene rivelata.",
        "Pennello, colore, dimensione e gomma producono tratti vettoriali sincronizzati."
      ],
      deep: [
        detail("Canvas", "Il server accetta tratti solo dal disegnatore attivo, limita punti e frequenza, assegna un id e li inoltra nell'ordine canonico."),
        detail("Prompt", "Parole e consegne sono viste soltanto dal destinatario. Indizi in chat vengono normalizzati per impedire l'invio diretto della soluzione."),
        detail("Recupero", "I tratti sono registrati come vettori compatti; un giocatore che rientra riceve snapshot più operazioni successive, non un flusso storico infinito.")
      ]
    },
    example: { type: "canvas", title: "Esempio: tratto vettoriale condiviso" }
  }
]);

export const GAME_BY_ID = new Map(GAME_CATALOG.map((game) => [game.id, game]));

export function getGame(gameId) {
  return GAME_BY_ID.get(gameId) ?? null;
}

export function toPublicGame(game) {
  const { accent, description, example, id, implementation, name, players, rules, tag } = game;
  return { accent, description, example, id, implementation, name, players, rules, tag };
}
