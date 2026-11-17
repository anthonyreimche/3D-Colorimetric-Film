// Auto-adjust against upstream's auto_adjust_3dcf_params, compiled by
// test/reference/build.mjs, on a lit wedge with saturated stripes: each
// contrast rendering, measured over the whole frame and with a picked grey.

import { describe, expect, it } from "vitest";
import { autoAdjust, type AutoMode } from "../src/autotune";
import fixturesText from "./reference/fixtures.json?raw";

interface Auto {
  width: number;
  height: number;
  scene: [number, number, number][];
  runs: { mode: AutoMode; picked: number; result: Record<string, number> }[];
}

const auto = (JSON.parse(fixturesText) as { auto: Auto }).auto;
const rgba = new Float32Array(auto.scene.flatMap(([r, g, b]) => [r, g, b, 1]));

describe("auto-adjust", () => {
  it.each(auto.runs)("mode $mode, picked grey $picked", ({ mode, picked, result }) => {
    const got = autoAdjust(rgba, auto.width * auto.height, mode, picked);
    expect(got).not.toBeNull();
    for (const [key, want] of Object.entries(result)) {
      expect(got?.[key as keyof typeof got], key).toBeCloseTo(want, 4);
    }
  });

  it("measures nothing in a black frame", () => {
    expect(autoAdjust(new Float32Array(16), 4, 1)).toBeNull();
  });
});
