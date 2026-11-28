// The detail recovery reads the transform's pre-pass (slTransformPass) as
// guided-filter coefficients. Core says whether that result is the real one
// (slTransformPassValid: drawn this frame, from the transform's input, on
// float targets); where it isn't, the coefficients come from another image
// and the recovery must stay off. The GPU spec checks the render
// (test/gpu/tdcf.webgl.test.ts); this keeps the gate in the GLSL text.

import { describe, expect, it } from "vitest";
import { HELPERS } from "../src/glsl";
import safelight from "../safelight.json";

const body = (name: string): string => {
  const start = HELPERS.indexOf(`vec3 ${name}(`);
  expect(start, `${name} is in the helpers`).toBeGreaterThanOrEqual(0);
  const open = HELPERS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < HELPERS.length; i++) {
    if (HELPERS[i] === "{") depth++;
    if (HELPERS[i] === "}" && --depth === 0) return HELPERS.slice(open, i + 1);
  }
  throw new Error(`${name} has no closing brace`);
};

describe("detail recovery pre-pass gate", () => {
  it("runs the recovery only where the pre-pass result is valid", () => {
    const process = body("tdcfProcess");
    expect(process).toMatch(/if \(tdcfLookMix\.w > 0\.0 && slTransformPassValid\) o = tdcfRecover\(/);
  });

  it("is the only reader of the pre-pass result", () => {
    const readers = HELPERS.split("\n").filter((line) => line.includes("slTransformPass") && !line.includes("slTransformPassValid"));
    expect(readers.every((line) => line.includes("slTransformPass.x") || line.includes("slTransformPass.y"))).toBe(true);
    expect(body("tdcfRecover")).not.toContain("slTransformPassValid");
  });

  it("needs a Safelight that declares slTransformPassValid", () => {
    const [major, minor, patch] = safelight.minAppVersion.split(".").map(Number);
    const atLeast328 = major !== 3 ? major > 3 : minor !== 2 ? minor > 2 : patch >= 8;
    expect(atLeast328).toBe(true);
  });
});
