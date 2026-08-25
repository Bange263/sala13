# Incremental delivery roadmap

The project is intentionally split into vertical slices. A “finished” engine
includes server rules, private projections, tests, browser UI, reconnect and
Info—not only a board that can be clicked.

## v0.3.2 LAN browser and device-layout checkpoint

- player and drawing identifiers work over plain HTTP LAN/VPN origins where
  `crypto.randomUUID` is unavailable;
- an icon-based Telefono/Computer gate appears on entry and remains switchable
  from the header;
- mobile mode uses a single-column room, touch-sized controls, compact cards,
  full-width actions and a stacked leaderboard.

## v0.3.1 LAN/VPN connectivity checkpoint

- the server continues to bind to every IPv4 interface by default;
- Socket.IO now explicitly follows the browser origin instead of relying on an implicit default;
- startup prints the usable LAN, Tailscale and ZeroTier addresses;
- Windows hosts have an idempotent Private-profile firewall setup command.

## v0.3 visual-table checkpoint

Every mode now uses a dedicated responsive table instead of generic text
controls. French and Neapolitan cards are local image assets; Blackjack and
Poker expose separate chip/action consoles; every mode has a scoreboard or
turn panel. Drawing guesses accept tightly bounded spelling mistakes, report
the correction as a system message and support undoing the latest stroke.

## v0.2 checkpoint

Phases 0–6 now have a playable core in the repository: every catalogue entry
has an authoritative engine, player-specific projection and browser controls.
The phase descriptions below are retained as the acceptance checklist for
deeper rule fixtures and hardening. Phase 7 remains open and is required before
an untrusted public deployment.

## Phase 0 — platform kernel (included)

- monorepo, static frontend and Express/Socket.IO server;
- public/private lobby lifecycle and adaptive capacity;
- validation, rate limit, versions and room cleanup;
- responsive menu and dynamic Info system;
- Tic-Tac-Toe vertical slice;
- deployment and CI templates.

Exit: two browsers can create, discover, join, play, reconnect and leave.

## Phase 1 — visible-state board games

1. Connect Four: gravity and four-direction scan.
2. Checkers: forced capture and multi-jump paths.
3. Chess: integrate/test a maintained rules library.

Exit: shared board component, move history and draw/result patterns are stable.

## Phase 2 — hidden information

1. Battleship: private projections and placement validation.
2. Briscola: secure deck, hands, trick evaluator and teams.
3. Scopa: subset captures and complete scoring breakdown.

Exit: automated tests prove that opponent socket payloads never contain hidden
cards or ship cells.

## Phase 3 — timed word games

1. Hangman: Unicode-aware normalization and SVG stage.
2. Categories: default/custom category selection, deadlines, reveal and votes.

Exit: server deadlines remain correct with simulated slow/disconnected clients.

## Phase 4 — richer card state machines

1. Blackjack: chips, split hands, double and dealer policy.
2. Uno: action pipeline and explicit stacking variants.
3. Burraco: meld validator, pozzetti and explained scoring.

Exit: property/fixture tests cover card conservation—every physical card is in
exactly one valid zone at every transition.

## Phase 5 — drawing modes

- batched normalized vector strokes;
- authoritative drawer permission and operation sequence;
- snapshot/reconnect;
- drawing/guess rotation;
- private pass-the-prompt chains and final reveal;
- moderation and strict resource limits.

Exit: a phone can draw smoothly while several viewers receive the same ordered
result, and refresh reconstructs the canvas.

## Phase 6 — Texas Hold'em

- seating/button/blinds;
- betting action and minimum-raise rules;
- all-in side pots;
- evaluator fixtures;
- secure hole-card views and showdown policy;
- chip conservation invariants.

Poker is last because incorrect side-pot or action-reopen logic can appear to
work in normal hands while failing on rare combinations.

## Phase 7 — operational hardening

- server-issued signed sessions;
- SQLite users/results and migrations;
- admin kick/ban and content reports;
- structured logs and metrics;
- load test on target Raspberry Pi;
- backup/recovery drill;
- privacy and acceptable-use text;
- optional Redis only if multiple Node instances are actually needed.

## Suggested two-person split

Do not permanently assign “frontend” to one student and “backend” to the other;
that creates knowledge silos. Split by vertical slice and review each other's
engine/UI pair.

| Sprint | Student A | Student B | Joint review |
| --- | --- | --- | --- |
| 1 | Connect Four engine/tests | Connect Four renderer/accessibility | two-browser test |
| 2 | Battleship placement/view | Battleship grids/effects | secret-payload audit |
| 3 | Briscola engine | reusable card-hand UI | reconnect/card conservation |
| 4 | Categories phases | forms/voting UI | deadline/network throttle |

Every pull request should include rule references, tests, screenshots for
layout changes and a short manual test script.

## School presentation storyline

1. Explain why WebSockets are needed.
2. Create a public room on the Raspberry Pi.
3. Join from a phone on a different network through Tailscale.
4. Show that private rooms do not appear publicly.
5. Play Tic-Tac-Toe and deliberately send/demonstrate an invalid second move.
6. Open Info to show shared rules and SVG examples.
7. Refresh a player to demonstrate reconnect.
8. Show the server-only engine test that detects the winner.
9. Present one hidden-information projection example.
10. Close both browsers and show automatic lobby cleanup.

That demonstration proves architecture, security boundaries and deployment—not
only visual styling.
