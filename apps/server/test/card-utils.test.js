import assert from "node:assert/strict";
import test from "node:test";
import { dealRoundRobin, projectHands, secureShuffle } from "../src/games/card-utils.js";

test("secureShuffle does not mutate the source and preserves every card", () => {
  const source = ["a", "b", "c", "d"];
  const shuffled = secureShuffle(source, () => 0);
  assert.deepEqual(source, ["a", "b", "c", "d"]);
  assert.deepEqual([...shuffled].sort(), [...source].sort());
  assert.notDeepEqual(shuffled, source);
});

test("dealRoundRobin and projectHands keep opponent identities hidden", () => {
  const { hands, deck } = dealRoundRobin([1, 2, 3, 4, 5, 6], ["p1", "p2"], 2);
  assert.deepEqual(hands, { p1: [1, 3], p2: [2, 4] });
  assert.deepEqual(deck, [5, 6]);
  assert.deepEqual(projectHands(hands, "p1"), { p1: [1, 3], p2: { count: 2 } });
});
