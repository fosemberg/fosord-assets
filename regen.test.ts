import { test, expect } from "bun:test";
import { resolveTargets } from "./regen";

const PNGS = [
  "goblin",
  "goblin__skin_bw",
  "goblin__skin_2",
  "goblin__form_storm",
  "goblin_king", // separate card id, NOT a goblin variant
  "dragon",
];

test("bare id takes the base image and every variant", () => {
  expect(resolveTargets(["goblin"], PNGS).targets).toEqual([
    "goblin",
    "goblin__form_storm",
    "goblin__skin_2",
    "goblin__skin_bw",
  ]);
});

test("a single-underscore neighbour is a different card, not a variant", () => {
  expect(resolveTargets(["goblin"], PNGS).targets).not.toContain("goblin_king");
  expect(resolveTargets(["goblin_king"], PNGS).targets).toEqual(["goblin_king"]);
});

test("a name with a __ segment is matched exactly", () => {
  expect(resolveTargets(["goblin__skin_bw"], PNGS).targets).toEqual(["goblin__skin_bw"]);
});

test("extensions are tolerated on either side", () => {
  expect(resolveTargets(["goblin__skin_bw.webp", "dragon.png"], PNGS).targets).toEqual([
    "dragon",
    "goblin__skin_bw",
  ]);
});

test("overlapping args are de-duplicated", () => {
  const { targets } = resolveTargets(["goblin", "goblin__skin_bw"], PNGS);
  expect(targets.filter(n => n === "goblin__skin_bw")).toHaveLength(1);
});

test("unknown names are reported, not silently dropped", () => {
  const { targets, unmatched } = resolveTargets(["dragon", "wyvern", "goblin__skin_9"], PNGS);
  expect(targets).toEqual(["dragon"]);
  expect(unmatched).toEqual(["wyvern", "goblin__skin_9"]);
});
