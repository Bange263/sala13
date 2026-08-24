# Contributing

Keep game rules in server engines. Browser modules render state and send intent;
they must not decide legal moves, shuffle decks or award points.

For a new engine:

1. read `docs/ARCHITECTURE.md` and the relevant game blueprint;
2. implement the `EngineContract` methods;
3. expose only a player-safe projection from `view()`;
4. register the engine in `game-registry.js`;
5. add domain tests for legal moves, every illegal edge case and completion;
6. then create the browser renderer;
7. update the catalogue status from `blueprint` to `playable` only after a
   complete two-browser smoke test.

Use small commits and never include `.env`, credentials, private tunnel URLs or
unlicensed game art.
