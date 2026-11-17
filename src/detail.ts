// This file is part of darktable,
// Copyright (C) 2026 darktable developers.
// Libre DT-lab Edition (C) 2026, designed and developed by Christian Bouhon.
//
// darktable is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// darktable is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with darktable.  If not, see <http://www.gnu.org/licenses/>.
//
// The detail recovery of libre-dt-lab src/iop/3dcf.c process() (ccb00d1b9,
// L2652-2831): a guided filter's base of the exposure-scaled luminance, and
// each tone-mapped pixel re-scaled by the detail the tone mapping smoothed
// away. The twin of glsl-detail.ts and of the transform's detail step.
//
// Upstream guides the filter with the pixel's RGB (a 3×3 solve over 13 box-
// filtered planes, src/common/guided_filter.c). The filtered value is that
// RGB's luminance, so this port lets the luminance guide itself, which a GPU
// pass chain of four channels can carry: a = var / (var + eps), b = mean (1 - a),
// each box-filtered again. On photos the result stays within a mean ΔE2000
// of 0.05 of upstream's at the default strength (README).

import type { Vec3 } from "./colour/mat3";
import type { Context } from "./context";
import { desatWeight, processPixel } from "./twin";

/** The filter's regularisation: guided_filter's sqrt_eps of 0.05, squared. */
export const GUIDED_EPS = 0.05 * 0.05;

/** The radius upstream gives the filter, in pixels of the full image. */
export const guidedRadius = (width: number, height: number): number =>
  Math.trunc(Math.max(4, (8 * Math.hypot(width, height)) / 8848));

/** process()'s detail luminance: the sanitised pixel's luma, exposure-scaled. */
export function detailLuma(rgb: Vec3, ctx: Context): number {
  const lc = ctx.lumaCoeff;
  const s = rgb.map((v) => (Number.isFinite(v) ? Math.max(v, 0) : 0));
  return (lc[0] * s[0] + lc[1] * s[1] + lc[2] * s[2]) * ctx.exposureFactor;
}

/** Weight of the tap `i` texels from the centre in a box of `radius` texels:
 *  1 out to the radius, the radius's fraction on the tap beyond, so a whole
 *  radius is upstream's box exactly. */
export const tapWeight = (i: number, radius: number): number => Math.min(Math.max(radius + 1 - Math.abs(i), 0), 1);

/** The box mean of `n` planes along one axis, each window clipped to the
 *  image and averaged over the taps inside it, as box_filters.cc does. */
function boxAxis(planes: Float64Array[], w: number, h: number, radius: number, horizontal: boolean): Float64Array[] {
  const reach = Math.floor(radius) + 1;
  return planes.map((pl) => {
    const out = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let weight = 0;
        for (let i = -reach; i <= reach; i++) {
          const xx = horizontal ? x + i : x;
          const yy = horizontal ? y : y + i;
          const t = tapWeight(i, radius);
          if (t <= 0 || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          sum += t * pl[yy * w + xx];
          weight += t;
        }
        out[y * w + x] = sum / weight;
      }
    }
    return out;
  });
}

const box = (planes: Float64Array[], w: number, h: number, radius: number): Float64Array[] =>
  boxAxis(boxAxis(planes, w, h, radius, true), w, h, radius, false);

/** The guided filter's coefficients at each pixel, box-filtered: the base is
 *  max(meanA * p + meanB, 0) for the pixel's luminance p. */
export function guidedCoefficients(luma: Float64Array, w: number, h: number, radius: number): { a: Float64Array; b: Float64Array } {
  const sq = luma.map((p) => p * p);
  const [mean, meanSq] = box([luma, sq], w, h, radius);
  const a = new Float64Array(w * h);
  const b = new Float64Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const variance = meanSq[k] - mean[k] * mean[k];
    a[k] = variance / (variance + GUIDED_EPS);
    b[k] = mean[k] - a[k] * mean[k];
  }
  const [ma, mb] = box([a, b], w, h, radius);
  return { a: ma, b: mb };
}

/** process()'s re-scale of a tone-mapped pixel by the detail it lost. */
export function recoverDetail(out: Vec3, rgbIn: Vec3, base: number, ctx: Context, recovery: number): Vec3 {
  if (!(recovery > 0)) return out;
  const lc = ctx.lumaCoeff;
  const lumOrig = detailLuma(rgbIn, ctx);
  const lumTm = lc[0] * out[0] + lc[1] * out[1] + lc[2] * out[2];
  if (!(lumTm > 1e-6 && lumOrig > 1e-6)) return out;

  const sanitised = rgbIn.map((v) => (Number.isFinite(v) ? Math.max(v, 0) : 0));
  const lum = Math.max(sanitised[0], sanitised[1], sanitised[2]);
  const w = desatWeight(lum * ctx.exposureFactor, ctx.hlDesat, ctx.hlDesatThreshold);
  let desatFactor = 0;
  if (w > 0 && Number.isFinite(w)) {
    const t = Math.min(w, 1);
    desatFactor = (t * t) / (t * t + (1 - t) * (1 - t) + 1e-6);
  }

  let detail = lumOrig - base;
  const t = Math.min(recovery, 1);
  const dl = Math.max(lumOrig * 0.1 * (1 - t * 0.5), 1e-6);
  const da = Math.abs(detail);
  if (da > dl) {
    const excess = da - dl;
    const bsteep = Math.max(dl * 0.25 * (1 - t * 0.4), 0.001);
    const v = dl + (excess / (excess + bsteep)) * bsteep;
    detail = detail < 0 ? -v : v;
  }
  const lumFinal = lumTm + detail * recovery * (1 - desatFactor) * (lumTm / lumOrig);
  if (!(lumFinal > 1e-6)) return out;
  const scale = Math.max(lumFinal / lumTm, 0.25);
  return [out[0] * scale, out[1] * scale, out[2] * scale];
}

/** process() over a whole Rec.2020 image (row-major RGB triples) with the
 *  detail recovery, `radius` in pixels of this image. */
export function processImage(
  pixels: readonly Vec3[],
  w: number,
  h: number,
  ctx: Context,
  look: number,
  lookOpacity: number,
  recovery: number,
  radius = guidedRadius(w, h),
): Vec3[] {
  const outs = pixels.map((px) => processPixel(px, ctx, look, lookOpacity));
  if (!(recovery > 0)) return outs;
  const luma = Float64Array.from(pixels, (px) => detailLuma(px, ctx));
  const { a, b } = guidedCoefficients(luma, w, h, radius);
  return outs.map((out, k) => recoverDetail(out, pixels[k], Math.max(a[k] * luma[k] + b[k], 0), ctx, recovery));
}
