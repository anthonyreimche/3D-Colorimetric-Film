// The detail recovery against upstream's process() compiled by
// test/reference/build.mjs: with the grey-guided filter this port runs, to
// float precision, and how far that lands from upstream's colour-guided one.

import { describe, expect, it } from "vitest";
import type { Vec3 } from "../src/colour/mat3";
import { computeContext } from "../src/context";
import { guidedRadius, processImage, tapWeight } from "../src/detail";
import { DEFAULTS } from "../src/params";
import fixturesText from "./reference/fixtures.json?raw";

interface Detail {
  width: number;
  height: number;
  scene: Vec3[];
  runs: { detail: number; grey: number; output: number[] }[];
}

const detail = (JSON.parse(fixturesText) as { detail: Detail }).detail;

// The scene renders at a chroma contrast of 0.1, where upstream's float C is accurate (reference.test.ts).
const PARAMS = { ...DEFAULTS, chroma_x_contrast: 0.1, chroma_z_contrast: 0.1 };

const render = (recovery: number): Vec3[] => {
  const ctx = computeContext({ ...PARAMS, hl_detail_recovery: recovery });
  return processImage(detail.scene, detail.width, detail.height, ctx, 0, 1, recovery);
};

const worst = (got: Vec3[], want: number[]): number =>
  Math.max(...got.map((px, k) => Math.max(...px.map((v, c) => Math.abs(v - want[3 * k + c]) / Math.max(want[3 * k], want[3 * k + 1], want[3 * k + 2], 1e-3)))));

describe("detail recovery", () => {
  it.each(detail.runs.filter((r) => r.grey === 1))("matches upstream's process() with the grey-guided filter at $detail", ({ detail: d, output }) => {
    expect(worst(render(d), output)).toBeLessThan(2e-5);
  });

  // The grey guide departs from upstream's colour guide where colour edges
  // don't follow luminance. This synthetic scene puts saturated patches on
  // every ninth pixel, so its worst pixel is far off a photo's (README).
  it.each(detail.runs.filter((r) => r.grey === 0))("stays near upstream's colour-guided filter at $detail", ({ detail: d, output }) => {
    expect(worst(render(d), output)).toBeLessThan(d < 0.5 ? 0.025 : 0.09);
  });

  it("changes the picture, and nothing at 0", () => {
    const off = render(0);
    expect(worst(render(1), off.flat())).toBeGreaterThan(0.01);
    const ctx = computeContext({ ...PARAMS, hl_detail_recovery: 0 });
    expect(processImage(detail.scene, detail.width, detail.height, ctx, 0, 1, 0)).toEqual(off);
  });

  it("takes upstream's radius from the full image's diagonal", () => {
    expect(guidedRadius(36, 27)).toBe(4);
    expect(guidedRadius(6000, 4000)).toBe(6);
    expect(guidedRadius(11648, 8736)).toBe(13);
  });

  it("weighs whole taps out to a whole radius, and the fraction beyond it", () => {
    expect([0, 4, 5].map((i) => tapWeight(i, 4))).toEqual([1, 1, 0]);
    expect(tapWeight(5, 4.25)).toBeCloseTo(0.25, 12);
  });
});
