/**
 * Reference contract for every Sala13 server-authoritative game engine.
 *
 * Engines are deliberately stateless classes: the Room owns the canonical
 * state and serializes every call. Hidden data must be removed in view().
 */
export class EngineContract {
  static implemented = false;

  /** @returns {object} canonical server-only state */
  static start({ players, settings }) {
    void players;
    void settings;
    throw new Error("Engine.start must be implemented");
  }

  /**
   * Validate an intent and return the next canonical state. Never trust a
   * client-supplied card, score, random value, target result, or timestamp.
   */
  static applyAction({ action, playerId, players, settings, state }) {
    void action;
    void playerId;
    void players;
    void settings;
    void state;
    throw new Error("Engine.applyAction must be implemented");
  }

  /** @returns {object} a player-specific projection with secrets redacted */
  static view(state, playerId) {
    void state;
    void playerId;
    throw new Error("Engine.view must be implemented");
  }

  static isFinished(state) {
    void state;
    return false;
  }
}
