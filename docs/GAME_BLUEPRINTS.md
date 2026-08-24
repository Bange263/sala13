# Game-engine blueprints

These plans define server state, accepted intent and hard validation. Browser UI
details may change without changing these contracts.

## Delivery matrix

| Game id | Players | Hidden information | Main complexity | Starter status |
| --- | ---: | --- | --- | --- |
| `blackjack` | 2–7 | deck, dealer hole card | split hands and bets | blueprint |
| `uno` | 2–10 | deck and hands | action effects and house rules | blueprint |
| `scopa` | 2 or 4 | deck and hands | legal capture sets and Primiera | blueprint |
| `briscola` | 2 or 4 | deck and hands | trick order and teams | blueprint |
| `texas-holdem` | 2–10 | deck and hole cards | betting/side pots/evaluator | blueprint |
| `burraco` | 2–4 | deck, hands, pozzetti | meld validation and scoring | blueprint |
| `battleship` | 2 | opponent fleet | placement and shot projection | blueprint |
| `chess-checkers` | 2 | none | complete legal-move rules | blueprint |
| `tic-tac-toe` | 2 | none | small turn state | playable |
| `categories` | 2–20 | answers until reveal | timer, voting and normalization | blueprint |
| `hangman` | 2–12 | solution | normalized word matching | blueprint |
| `connect-four` | 2 | none | gravity and four-line scan | blueprint |
| `draw-and-pass` | 2–12 | prompts/chains | vector canvas and rotation | blueprint |

## Shared engine conventions

- Phase is explicit; never infer it only from UI or array length.
- Player order is an array of stable player ids, not socket ids.
- Every accepted command records `lastAction` with a server timestamp for UI
  explanation, but secrets must not appear there.
- Random operations use `secureShuffle()` or `crypto.randomInt()`.
- Currency/chips are integers. Avoid floating-point money.
- Settings are fixed when play starts and included in the Info projection.
- A `result` object is the only completion source; the client does not announce
  a winner.

## 1. Blackjack

### Settings

```ts
type BlackjackSettings = {
  maxPlayers: 2 | 3 | 4 | 5 | 6 | 7;
  decks: 1 | 2 | 4 | 6 | 8;
  startingChips: number;
  minimumBet: number;
  maximumBet: number;
  dealerHitsSoft17: boolean;
  blackjackPayout: { numerator: 3; denominator: 2 } | { numerator: 6; denominator: 5 };
  allowInsurance: boolean;
  splitLimit: number;
  doubleAfterSplit: boolean;
};
```

### Canonical state

- `phase`: `betting | dealing | insurance | player-turns | dealer-turn | payout`;
- shoe and discard pile;
- dealer cards with first card marked hidden until dealer phase;
- per-player chips, original bet and an array of hands;
- each hand: cards, bet, `active | stood | busted | blackjack | doubled`, and
  split metadata;
- current player and current hand index;
- immutable round results.

### Intents

`place-bet`, `take-insurance`, `decline-insurance`, `hit`, `stand`, `double`,
`split`, `start-next-round`.

### Validation and algorithms

- Accept a bet only in range and not above the player's chip balance.
- Compute ace totals by starting all aces at 11 and subtracting 10 while over
  21. Return both total and `soft` flag.
- Natural blackjack applies only to the original two-card hand unless settings
  state otherwise; a split 21 is normally not a natural.
- `double` requires exactly two cards and sufficient chips; it adds one card and
  auto-stands.
- `split` requires a pair according to the declared rule (same rank or same
  ten-value), available chips and remaining split capacity.
- The dealer hole card is absent from every player view until reveal; do not send
  it with `hidden: true` because browser inspection would still expose it.
- Payout calculations should return integer chip units. If 3:2 can create half
  units, define the smallest chip denomination so every payout is integral.

## 2. Uno

### Settings

Deck composition, hand size, stacking policy (`off | same-symbol | draw-any`),
draw-until-playable, jump-in, forced-play, score target and +4 challenge policy.
The Info modal must label non-standard options as house rules.

### Canonical state

- draw and discard piles;
- complete hand per player;
- direction `1 | -1`, current index and active color;
- pending draw count/type and pending skip count;
- whether the current player has declared Uno;
- phase `playing | choosing-color | challenge | finished`;
- round and match score.

### Intents

`play-card(cardId, declaredColor?)`, `draw-card`, `pass`, `call-uno`,
`challenge-wild-draw-four`, `accept-draw`.

### Validation and algorithms

- A normal card matches active color, rank or action symbol.
- Wild requires a valid declared color in the same atomic action.
- +4 legality is checked against the server-known pre-play hand. Save whether a
  matching active-color card existed so a challenge can be resolved later.
- Apply Reverse as a direction change; with two players it behaves as a skip if
  that is the selected ruleset.
- When the draw pile is empty, retain the top discard and securely reshuffle all
  older discards.
- Stacking is a state machine: while `pendingDraw > 0`, only explicitly allowed
  counter cards or `accept-draw` are legal.
- Hands in opponent views are `{ count }` only.

## 3. Scopa

### Card model

Forty immutable ids: four suits (`denari`, `coppe`, `spade`, `bastoni`) and
values 1–10. Figure artwork is presentation; capture value remains 8, 9 or 10.

### Canonical state

- shuffled deck, table cards and private hands;
- order, current player and teams for four players;
- captured cards and scopa count per team;
- last team to capture;
- deal number and match score.

### Intent

`play-card(cardId, captureCardIds[])`.

### Legal-capture algorithm

1. Verify `cardId` is in the sender's hand.
2. Build table cards matching the played value.
3. If any exact matches exist, legal choices are individual exact-match cards;
   sums are forbidden.
4. Otherwise enumerate unique subsets of table cards whose values sum to the
   played value. The submitted capture set must exactly match one legal subset.
5. With no legal capture, place the played card on the table.
6. If a capture empties the table, add a scopa unless it is the final play of
   the final deal.
7. After the last hand, give remaining table cards to the last capturing team.

The table has few cards, so a bounded bit-mask subset search is simple and safe:

```js
for (let mask = 1; mask < 1 << table.length; mask += 1) {
  const subset = table.filter((_, index) => mask & (1 << index));
  if (sum(subset.map(card => card.value)) === played.value) choices.push(subset);
}
```

Set a sensible maximum table length as an invariant; do not apply this approach
to unbounded arrays.

### Scoring

- `Carte`: strict majority of 40;
- `Denari`: strict majority of 10;
- `Settebello`: team holding seven of denari;
- `Primiera`: select the best card in every suit using weights
  `7=21, 6=18, A=16, 5=15, 4=14, 3=13, 2=12, figures=10`; a team missing any
  suit cannot win Primiera;
- one point per recorded scopa.

Return a score breakdown so the UI can explain every point.

## 4. Briscola

### Canonical state

Deck, face-up trump indicator, trump suit, private hands, two-card/four-card
trick, leader/current player, captured cards, teams and score.

### Intent

`play-card(cardId)`.

### Trick comparison

1. A trump beats every non-trump.
2. Between trumps, compare Briscola rank.
3. Without trump, a card of the lead suit beats off-suit cards.
4. Between cards of the lead suit, compare rank.
5. An off-suit non-trump cannot beat the current winner.

Rank strength: Ace, Three, King, Knight, Jack, 7, 6, 5, 4, 2. Point values:
11, 10, 4, 3, 2 and zero for the rest. The trick winner leads and draws first;
other players draw in seat order. The face-up indicator is the final draw.

Total points must equal 120. A team wins at 61; 60–60 is a draw.

## 5. Texas Hold'em

Poker must be implemented as a separately tested subsystem rather than a large
switch statement inside a socket handler.

### Canonical state

- ordered seats, dealer button, blinds and optional ante;
- chip stacks and per-hand contribution for each player;
- two private hole cards per active player;
- community cards and burn cards;
- street: `preflop | flop | turn | river | showdown | hand-complete`;
- current actor, call amount, last full raise and players who may reopen action;
- folded, all-in and disconnected flags;
- main/side pots with eligible player sets.

### Intents

`fold`, `check`, `call`, `bet(amount)`, `raise-to(amount)`, `show-or-muck`,
`start-next-hand`.

Use `raise-to`, not ambiguous `raise-by`, in the public protocol.

### Betting rules

- The actor must match the canonical current seat.
- `check` only when contribution equals the amount to call.
- `call` contributes `min(callGap, stack)` and may create an all-in.
- A full raise must meet the minimum; a short all-in may increase the call
  amount without reopening raising for players who already acted.
- A street ends when every non-folded, non-all-in player has matched the current
  amount and acted since the last full raise.
- If only one player remains, award without revealing hidden cards.

### Side pots

Sort distinct total contributions. For each contribution tier, subtract the
previous tier and multiply by the number of players who reached it. Eligible
winners are non-folded players who contributed at least that tier. Split ties
with integer chips; assign odd chips in declared clockwise order from the
dealer.

### Hand evaluator

Evaluate the best five of seven cards. Use a comparable tuple such as:

```text
[category, primaryRank, secondaryRank, kicker1, kicker2, kicker3]
```

Category ordering: straight flush, four of a kind, full house, flush, straight,
three of a kind, two pair, pair, high card. Handle wheel straight A-2-3-4-5.
Test all categories, same-category kickers and board-only ties with published
fixtures before exposing chips.

## 6. Burraco

Agree on the exact school rules before coding; Burraco variants differ in deal,
allowed melds, discard pickup and bonuses.

### Canonical state

- two combined decks including declared jokers/pinelle;
- private hands, stock, visible discard pile and two hidden pozzetti;
- teams and active player;
- team melds composed of stable card ids and declared order;
- flags for pozzetto taken and method (`direct | after-discard`);
- classified clean/dirty/semi-clean burracos;
- phase and score breakdown.

### Intents

`draw-stock`, `take-discard`, `open-meld(cardIds, arrangement)`,
`extend-meld(meldId, cardIds, arrangement)`, `rearrange-meld`, `discard(cardId)`,
`take-pozzetto`, `close-round`.

### Meld validation

- Group: same rank, suit duplication and wildcard limits according to settings.
- Sequence: same suit, monotonic ranks, Ace position policy and wildcard gaps.
- Validate the complete resulting meld after an edit, not only inserted cards.
- Preserve stable card identity because two physical decks contain duplicates.
- Classify a sequence/group of seven or more based on wildcard composition.
- Never accept client-calculated `clean: true` or score.

The server should return human-readable rejection reasons such as `gap requires
two wildcards` to make this complex UI usable.

## 7. Battleship

### Settings

Grid size, fleet lengths, whether ships may touch diagonally, salvo/single-shot
mode, and whether a hit grants another shot.

### Canonical state

- phase `placement | firing | finished`;
- per-player fleet with ship id, cells and hit set;
- per-player accepted-placement flag;
- shot history with attacker, coordinate and result;
- current player and winner.

### Intents

`place-fleet(ships[])`, `confirm-placement`, `fire(row,column)`.

### Placement validation

- exact fleet multiset;
- every ship straight and contiguous;
- within bounds, no duplicate cell, no overlap;
- optional surrounding-cell check for no-touch mode.

Do not stream the opponent's fleet in the room view. A player receives full own
grid and only public shot marks for the opponent grid. A shot result can include
`miss | hit | sunk` and sunk ship cells only if the selected rules reveal them.

CSS animates splash/impact after the accepted result; animation completion does
not advance the server turn.

## 8. Chess / Checkers

Use two engines registered behind one catalogue choice. Do not mix their rules
in a single board-move function.

### Chess

Canonical state should include board, side to move, castling rights, en-passant
target, halfmove clock, fullmove number and position repetition counts. An
intent is `move(from, to, promotion?)`.

Generate pseudo-legal moves, apply one to a copy, then reject it if the moving
side's king remains in check. Cover castling through attacked squares, en
passant exposing the king and promotion. Completion includes checkmate,
stalemate, insufficient material, agreed draw, fivefold/threefold policy and
75/50-move policy. Exporting FEN/PGN is useful but is not canonical validation.

For a school implementation, using a mature, permissively licensed chess rules
library is safer than inventing edge cases. Pin its version and keep the server
as the only caller.

### Italian checkers

Canonical state includes 8×8 dark-square pieces, side, forced capture path and
draw counters. Intent is `move(path[])` because a turn may contain multiple
jumps.

Generate all capture sequences before accepting a move. Apply the chosen
Italian priority rule when multiple captures exist and display that rule in
Info. Promotion timing and whether a newly crowned piece continues capturing
must be explicit. Win when the opponent has no pieces or no legal move; define
repetition/no-progress draw thresholds.

## 9. Tic-Tac-Toe

Implemented in `tic-tac-toe-engine.js`.

State: nine nullable cells, player-to-mark map, current player, move count,
winner, winning line and draw flag. Intent: `place(cell)`.

Validation checks exact turn, integer cell 0–8, empty cell and unfinished game.
After insertion, inspect eight possible lines, then a full-board draw. The room
version protects against duplicate or simultaneous moves. This engine is the
reference for tests and client rendering, but hidden-information games need an
additional projection layer.

## 10. Categories — Nomi, Cose, Città

`packages/shared/src/default-categories.js` contains more than eighty selectable
defaults. Custom categories are room settings, limited in count/length and
frozen before the first round.

### Canonical state

- selected categories;
- allowed letter pool and used letters;
- phase `spin | answering | reveal | voting | score | finished`;
- server-selected letter, start/end timestamp;
- private answer map per player until reveal;
- normalized groups of identical answers;
- votes per answer and score totals.

### Intents

`spin-letter` (host/system), `save-answer(categoryId,text)`, `submit-round`,
`stop-round` if enabled, `vote(answerId, valid|invalid|abstain)`, `next-round`.

### Validation

- Normalize whitespace and Unicode; compare case-insensitively but retain the
  original display form.
- Define how articles and accented initial letters are handled.
- The server deadline decides acceptance. Saving drafts may be allowed, but no
  answer text is projected to opponents until reveal.
- A player cannot vote on their own answer unless settings allow it.
- Quorum, tie and host override must be fixed in settings.
- Default scoring: 10 valid unique, 5 valid duplicate, 0 rejected/empty. Compute
  duplicate groups only among accepted normalized values.

For a public service, voting alone is not moderation; add prohibited-text
filters and reports.

## 11. Hangman

### Canonical state

Original solution, normalized grapheme representation, hint, revealed indices,
wrong letters, maximum mistakes, drawer stage, phase, current guesser/team and
result. The solution is server-only except for an optional human word setter.

### Intents

`set-word(solution,hint)` from the designated setter, `guess-letter(letter)`,
`guess-word(text)`, `next-round`.

### Validation

- Segment user-visible characters with `Intl.Segmenter` rather than assuming
  one UTF-16 code unit per letter.
- Normalize case and optional diacritics according to settings.
- Reveal all matching indices atomically.
- Reject repeated guesses without charging another mistake.
- Decide whether a wrong full-word guess costs one or multiple stages.
- Send only mask, revealed characters, wrong guesses and SVG stage to guessers.

The gallows drawing is deterministic presentation: the server returns a stage
number, and browser SVG maps it to body parts.

## 12. Connect Four

Recommended next implementation.

### Canonical state and intent

Six rows by seven columns, player-to-color map, current player, move count,
winner and winning coordinates. Intent: `drop(column)`.

### Transition

1. Validate integer column 0–6, sender turn and unfinished game.
2. Scan rows bottom-to-top and choose the first empty cell; reject a full
   column.
3. Insert the server-owned player's token.
4. From that cell, count same-color tokens in both directions for vectors
   `(1,0)`, `(0,1)`, `(1,1)`, `(1,-1)`.
5. A combined count of at least four wins; otherwise 42 moves draw.
6. Return landing row so the client can animate gravity to the accepted cell.

```js
function countLine(board, row, column, dr, dc, token) {
  let count = 1;
  for (const sign of [-1, 1]) {
    let r = row + dr * sign;
    let c = column + dc * sign;
    while (board[r]?.[c] === token) {
      count += 1;
      r += dr * sign;
      c += dc * sign;
    }
  }
  return count;
}
```

## 13. Draw & Pass

One engine supports two modes with separate phase machines.

### Drawing-only mode

Phases: choose drawer/prompt, draw-and-guess, round score, rotate. The drawer
receives the exact prompt; guessers receive category/length hints. Normalize
guesses and compare only on the server. First-correct and speed scores must use
server receive time.

### Pass-the-prompt mode

Each player starts a chain. At every timed step they receive exactly one private
item and submit either text or a drawing; assignments rotate so no player sees
future chain entries. After all steps, reveal each complete chain in order.

Canonical state:

- mode, phase, round/step and deadlines;
- player rotation and assignment map;
- private prompts;
- chain entries with author, type and accepted content;
- current canvas stroke log/snapshot per assignment;
- scores only if enabled.

Intents:

`begin-stroke`, `append-stroke`, `end-stroke`, `undo-own-stroke`, `clear-canvas`
if allowed, `submit-drawing`, `submit-text`, `guess`, `advance`.

### Canvas protocol

- Capture pointer coordinates normalized by canvas width/height.
- Batch points every 16–50 ms rather than one socket event per pointer event.
- Validate with `drawing-protocol.js` and rate-limit points separately from
  ordinary room actions.
- Server assigns operation sequence and broadcasts accepted vectors.
- Clients render with `requestAnimationFrame`; rendering speed never changes
  ordering.
- Persist a compact SVG/path or binary representation only at submission if
  later replay is required.
- Limit colors, brush size, strokes, total points and text length.

### Information safety

`view(state, playerId)` returns only the player's assigned prompt/current chain
entry. A generic room broadcast would leak every prompt, so this engine is the
strongest test of the player-specific projection architecture.

## Definition of done for any blueprint

A game becomes `playable` only when:

- every listed phase/action exists and has domain tests;
- all selected settings appear in Info and are immutable during play;
- two browsers can complete a match and rematch;
- refresh/reconnect does not reveal or corrupt state;
- illegal handcrafted socket payloads are rejected;
- opponent views have automated secret-redaction tests;
- mobile layout works at 360 CSS pixels;
- keyboard and screen-reader names exist for interactive cells/cards;
- empty-room cleanup and server shutdown remain clean;
- README status is updated honestly.
