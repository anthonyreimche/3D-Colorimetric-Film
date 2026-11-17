// The transform on the real renderer. Run via `npm run test:gpu` (run.cjs
// copies this file into a SafeLight checkout and runs it under its headless
// Chromium + SwiftShader rig). What the CPU suite can't check:
//  • the program compiles and links with the host's namespacing and derived
//    uniforms, beside the built-in stages, on process versions 2 and 3;
//  • over a grid of settings, every patch of a test chart matches the twin,
//    the detail recovery's pre-pass included (the chart is its own full image,
//    so the passes run at the twin's radius).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolvePipelineFor } from "@/extensions/pipelines";
import { registerPipeline, unregisterExtension } from "@/extensions/registry";
import { bagForRender } from "@/extensions/transform-derive";
import type { WebGLRenderer } from "@/rendering/webgl/renderer";
import {
  builtinStages, floatImage, identityParams, pixelAt, rendererBuildError, toHalf, withRenderer,
} from "@/rendering/webgl/webgl.test-support";
import { apply, type Vec3 } from "@tdcf/colour/mat3";
import { REC2020_TO_REC709, REC709_TO_REC2020 } from "@tdcf/colour/profiles";
import { computeContext } from "@tdcf/context";
import { processImage } from "@tdcf/detail";
import { DEFAULTS, type Params } from "@tdcf/params";
import { TRANSFORM_ID, colorimetricFilmTransform } from "@tdcf/transform";

const EXT = "colorimetric-film";

function patches(): Vec3[] {
  const out: Vec3[] = [];
  for (const ev of [-10, -6, -3, -1, 0, 1, 2.5, 4, 6]) {
    const v = 0.18 * 2 ** ev;
    out.push([v, v, v]);
  }
  for (const level of [0.05, 0.25, 1.2, 5]) {
    for (let h = 0; h < 360; h += 45) {
      const a = (h * Math.PI) / 180;
      out.push([0, 1, 2].map((k) => level * (1 + 0.85 * Math.cos(a - (2 * Math.PI * k) / 3))) as unknown as Vec3);
    }
  }
  out.push([1.5, 0.1, 0.05], [0.05, 1.2, 0.1], [0.1, 0.2, 3.0], [-0.2, 0.6, -0.1], [0.45, 0.3, 0.22], [0, 0, 0], [30, 25, 20]);
  return out;
}

const PATCHES = patches();
const W = PATCHES.length * 4;
const H = 4;
const CHART = floatImage(W, H, (x) => PATCHES[Math.floor(x / 4)]);
const CHART_PIXELS: Vec3[] = Array.from({ length: W * H }, (_, k) => PATCHES[Math.floor((k % W) / 4)]);
const AS_DRAWN = { encoding: "perceptual", primaries: "rec709" } as const;

beforeAll(() => registerPipeline(EXT, colorimetricFilmTransform()));
afterAll(() => unregisterExtension(EXT));

function render(bag: Record<string, unknown>, version: number): Vec3[] {
  const pipeline = resolvePipelineFor(TRANSFORM_ID);
  return withRenderer({ stages: [], pipeline, processVersionCap: 3 }, (r: WebGLRenderer) => {
    r.setImage(CHART);
    r.setParams(identityParams({ processVersion: version, displayTransform: TRANSFORM_ID }));
    r.setContributedParams(bagForRender(pipeline, bag));
    const f = r.readFloatFrame("pre-output", Infinity, AS_DRAWN);
    if (!f) throw new Error("readFloatFrame returned null");
    return PATCHES.map((_, i) => pixelAt(f, i * 4 + 1, H - 2));
  });
}

const encode = (x: number): number => {
  const a = Math.abs(x);
  return Math.sign(x) * (a < 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055);
};
// The source is RGBA16F, so the twin takes the values the GPU holds.
const half3 = (v: Vec3): Vec3 => [toHalf(v[0]), toHalf(v[1]), toHalf(v[2])];

const bagOf = (values: Record<string, number | boolean>) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [`${TRANSFORM_ID}.${k}`, v]));

const CASES: [string, Partial<Params>][] = [
  ["defaults", {}],
  ["no detail recovery", { hl_detail_recovery: 0 }],
  ["full detail recovery", { hl_detail_recovery: 1, input_exposure: 0.8 }],
  ["contrast and pivot", { contrast: 3.6, contrast_pivot: 0.3, toe_power: 1.8, shoulder_power: 0.5 }],
  ["soft and bright", { contrast: 0.6, gamma: 0.8, input_exposure: 1.2, peak_luminance: -70 }],
  ["peak +100", { peak_luminance: 100, input_exposure: -1.5 }],
  ["vibrance and boost", { vibrance: 1.8, chromatic_boost: 0.8 }],
  ["vibrance 0.3", { vibrance: 0.3 }],
  ["Abney", { hl_hue_shift: -0.9, hl_desaturation: 0.6, hl_desat_threshold: 0.2 }],
  ["no roll-off, tight gamut", { hl_desaturation: 0, gamut_knee: 0.05, gamut_steepness: 0.9 }],
  ["sRGB target", { output_cs: 0 }],
  ["ProPhoto target", { output_cs: 3 }],
  ["blue sky look", { color_look: 5 }],
  ["cinema look at 60%", { color_look: 9, look_opacity: 0.6 }],
  ["chroma contrast", { chroma_x_contrast: 6, chroma_z_contrast: 2.5, chroma_x_pivot: 35, chroma_z_pivot: 62 }],
  ["monochrome", { color_look: 11 }],
  ["monochrome filters", { color_look: 11, chroma_x_contrast: 9, chroma_z_contrast: 1, mono_green: 4 }],
];

describe("3D Colorimetric Film", () => {
  it("compiles beside the built-in stages", () => {
    expect(rendererBuildError({ stages: builtinStages(), pipeline: resolvePipelineFor(TRANSFORM_ID), processVersionCap: 3 })).toBeNull();
  });

  it.each(CASES)("matches the twin: %s", (label, over) => {
    const params: Params = { ...DEFAULTS, ...over };
    const ctx = computeContext(params);
    // The pre-pass keeps the filter's sums in half floats (the core's RGBA16F
    // pass targets). Measured: 3e-4 to 8e-4 off the twin, and 2.5e-3 beside the
    // chart's 30x-over-white patch, whose neighbourhood mean the halves hold
    // to about 5e-4 of its size; 7.5e-6 with the recovery off.
    const bound = params.hl_detail_recovery > 0 ? 3e-3 : 1e-3;
    const image = CHART_PIXELS.map((p) => apply(REC709_TO_REC2020, half3(p)));
    const out = processImage(image, W, H, ctx, params.color_look, params.look_opacity, params.hl_detail_recovery);
    const want = PATCHES.map((_, i) => apply(REC2020_TO_REC709, out[(H - 2) * W + i * 4 + 1]).map(encode));
    for (const version of [2, 3]) {
      const got = render(bagOf(params), version);
      got.forEach((g, i) =>
        g.forEach((v, ch) => {
          expect(Math.abs(v - want[i][ch]), `${label} v${version} patch ${i} ${JSON.stringify(PATCHES[i])} ch ${ch}: ${v} vs ${want[i][ch]}`).toBeLessThan(bound);
        }),
      );
    }
  });
});
