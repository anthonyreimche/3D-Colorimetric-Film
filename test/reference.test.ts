// The twin against upstream's own C, compiled by test/reference/build.mjs:
// the derived context, the tone curve and every pixel of every case. The C
// runs in floats and the twin in doubles, so they agree to float precision.

import { describe, expect, it } from "vitest";
import type { Vec3 } from "../src/colour/mat3";
import { OUTPUT_MATRIX, SPECTRAL_BOUNDARY, WHITE_X, WHITE_Z, computeContext } from "../src/context";
import { DEFAULTS, type Params } from "../src/params";
import { processPixel, toneCurve, computeYTm } from "../src/twin";
import fixturesText from "./reference/fixtures.json?raw";

interface Fixture {
  name: string;
  params: Partial<Params>;
  context: {
    exposure_factor: number;
    contrast_pivot: number;
    output_matrix: number[];
    luma_coeff: number[];
    white_chroma_x: number;
    white_chroma_z: number;
    gamma_power: number;
    spectral_boundary: number[];
    ssts: number[];
    chroma_x: number[];
    chroma_z: number[];
    mono_x_gain: number;
    mono_z_gain: number;
    monochrome: number;
    gamut_enable: number;
  };
  inputs: Vec3[];
  outputs: Vec3[];
  curve: [number, number, number][];
}

const fixtures = JSON.parse(fixturesText) as { cases: Fixture[] };

// Relative to the pixel's largest channel. The twin runs in doubles and the C
// in floats; at the 0.1 chroma gain the C's sigmoid normalisation still keeps
// a little of its cancellation (it shrinks as 1/gain), hence the looser bound.
const tolerance = (gainX: number, gainZ: number): number => (gainX >= 1 && gainZ >= 1 ? 1e-5 : 6e-5);

const close = (got: number, want: number, abs: number, rel = 0) => Math.abs(got - want) <= abs + rel * Math.abs(want);

describe("constants", () => {
  const ctx = fixtures.cases[0].context;
  it("white and output matrix", () => {
    expect(WHITE_X).toBeCloseTo(ctx.white_chroma_x, 6);
    expect(WHITE_Z).toBeCloseTo(ctx.white_chroma_z, 6);
    OUTPUT_MATRIX.forEach((v, i) => expect(close(v, ctx.output_matrix[i], 1e-6, 1e-6)).toBe(true));
  });
  it("spectral boundary, every degree", () => {
    SPECTRAL_BOUNDARY.forEach((v, i) => expect(close(v, ctx.spectral_boundary[i], 2e-6, 1e-5), `bin ${i}`).toBe(true));
  });
});

describe.each(fixtures.cases)("$name", (f) => {
  const params: Params = { ...DEFAULTS, ...f.params };
  const ctx = computeContext(params);

  it("derives upstream's context", () => {
    expect(close(ctx.exposureFactor, f.context.exposure_factor, 0, 1e-6)).toBe(true);
    expect(close(ctx.contrastPivot, f.context.contrast_pivot, 1e-7)).toBe(true);
    expect(close(ctx.gammaPower, f.context.gamma_power, 0, 1e-6)).toBe(true);
    ctx.lumaCoeff.forEach((v, i) => expect(v).toBeCloseTo(f.context.luma_coeff[i], 6));
    const s = ctx.ssts;
    [s.s2, s.m2, s.g, s.t1, s.nr, s.n].forEach((v, i) => expect(close(v, f.context.ssts[i], 0, 1e-6), `ssts ${i}`).toBe(true));
    for (const [axis, want] of [[ctx.chromaX, f.context.chroma_x], [ctx.chromaZ, f.context.chroma_z]] as const) {
      expect(axis.gain).toBeCloseTo(want[0], 6);
      expect(axis.shift).toBeCloseTo(want[1], 6);
      expect(close(axis.r05, want[4], 1e-5)).toBe(true);
    }
    expect(close(ctx.monoXGain, f.context.mono_x_gain, 1e-7)).toBe(true);
    expect(close(ctx.monoZGain, f.context.mono_z_gain, 1e-7)).toBe(true);
    expect(ctx.monochrome).toBe(f.context.monochrome === 1);
    expect(ctx.gamutEnable).toBe(f.context.gamut_enable === 1);
  });

  it("draws upstream's tone curve", () => {
    for (const [y, tm, full] of f.curve) {
      expect(close(computeYTm(y, ctx), tm, 2e-6, 2e-5), `y_tm at ${y}`).toBe(true);
      expect(close(toneCurve(y, ctx), full, 2e-6, 2e-5), `curve at ${y}`).toBe(true);
    }
  });

  it("renders every pixel as upstream does", () => {
    const bound = tolerance(ctx.chromaX.gain, ctx.chromaZ.gain);
    f.inputs.forEach((input, i) => {
      const got = processPixel(input, ctx, params.color_look, params.look_opacity);
      const scale = Math.max(...f.outputs[i], 1e-3);
      got.forEach((v, c) => expect(Math.abs(v - f.outputs[i][c]) / scale, `pixel ${i} ${JSON.stringify(input)} ch ${c}: ${v} vs ${f.outputs[i][c]}`).toBeLessThan(bound));
    });
  });
});
