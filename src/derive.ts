// 3D Colorimetric Film, a Safelight extension. GPL-3.0-or-later. See LICENSE.
//
// The uniforms glsl.ts reads, from the context of src/context.ts. The core
// runs this on the main thread wherever a photo's bag goes to a renderer.

import { IDENTITY, columnMajor, toMat3 } from "./colour/mat3";
import { computeContext } from "./context";
import type { Params } from "./params";
import type { GlslType } from "./safelight";
import { COLOR_LOOKS } from "./tables";

export const UNIFORM_TYPES = {
  tdcfTone: "vec4",
  tdcfCurve: "vec4",
  tdcfSstsP: "vec4",
  tdcfHl: "vec4",
  tdcfGamut: "vec4",
  tdcfLuma: "vec3",
  tdcfGamutFwd: "mat3",
  tdcfGamutInv: "mat3",
  tdcfChroma: "vec4",
  tdcfChromaN: "vec4",
  tdcfLook: "mat3",
  tdcfLookMix: "vec4",
} as const satisfies Readonly<Record<string, GlslType>>;

export type Uniforms = Record<keyof typeof UNIFORM_TYPES, number[]>;

const flag = (b: boolean): number => (b ? 1 : 0);

/** Packing: tdcfTone (exposure factor, contrast, pivot, mid-tones power),
 *  tdcfCurve (toe, shoulder, curve on, mid-tones on), tdcfSstsP (s2, m2, g,
 *  t1), tdcfHl (roll-off, threshold, Abney rotation, vibrance), tdcfGamut
 *  (knee, steepness, chromatic boost, protect to the target), tdcfChroma
 *  (X gain, X shift, Z gain, Z shift), tdcfChromaN (X and Z response at
 *  neutral, monochrome X and Z filter gains), tdcfLookMix (opacity, look on,
 *  monochrome, detail recovery). Matrices column-major. */
export function deriveUniforms(p: Params): Uniforms {
  const ctx = computeContext(p);
  const look = p.color_look >= 1 && p.color_look <= 10;
  const lookMatrix = look ? toMat3(COLOR_LOOKS.slice((p.color_look - 1) * 9, p.color_look * 9)) : IDENTITY;
  return {
    tdcfTone: [ctx.exposureFactor, ctx.contrast, ctx.contrastPivot, ctx.gammaPower],
    tdcfCurve: [
      ctx.toePower,
      ctx.shoulderPower,
      flag(ctx.contrast !== 1 || ctx.toePower !== 1 || ctx.shoulderPower !== 1),
      flag(ctx.gamma !== 0),
    ],
    tdcfSstsP: [ctx.ssts.s2, ctx.ssts.m2, ctx.ssts.g, ctx.ssts.t1],
    tdcfHl: [ctx.hlDesat, ctx.hlDesatThreshold, ctx.hlRotation, ctx.vibrance],
    tdcfGamut: [ctx.gamutKnee, ctx.gamutSteepness, ctx.chromaticBoost, flag(ctx.gamutEnable)],
    tdcfLuma: [...ctx.lumaCoeff],
    tdcfGamutFwd: columnMajor(ctx.gamutFwd),
    tdcfGamutInv: columnMajor(ctx.gamutInv),
    tdcfChroma: [ctx.chromaX.gain, ctx.chromaX.shift, ctx.chromaZ.gain, ctx.chromaZ.shift],
    tdcfChromaN: [ctx.chromaX.r05, ctx.chromaZ.r05, ctx.monoXGain, ctx.monoZGain],
    tdcfLook: columnMajor(lookMatrix),
    tdcfLookMix: [p.look_opacity, flag(look), flag(ctx.monochrome), Math.max(p.hl_detail_recovery, 0)],
  };
}
