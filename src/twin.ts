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
// The TypeScript twin of glsl.ts, in doubles. Transcribes libre-dt-lab
// src/iop/3dcf.c (ccb00d1b9): dt_st_compute_y_tm (L550-585), st_desat_weight
// (L1062-1069), st_gamut_compress (L1091-1122), st_output_gamut_protect
// (L1128-1144), st_reach_from_table and st_chroma_norm (L1413-1437),
// st_chroma_contrast_sigmoid (L1474-1556), st_spectral_gamut (L1558-1654),
// dt_st_pipeline_eval (L1671-1927), and process()'s per-pixel body (L2726-2788)
// without the detail recovery. Pixels are Rec.2020 (D50), scene-linear in and
// display-referred out, as upstream's working space holds them.

import { apply, type Vec3 } from "./colour/mat3";
import { REC2020_TO_REC709, REC709_TO_REC2020 } from "./colour/profiles";
import { INPUT_MATRIX, OUTPUT_MATRIX, SPECTRAL_BOUNDARY, WHITE_X, WHITE_Z, sigmoidResponse, sstsFwd, type Context } from "./context";
import { COLOR_LOOKS, GAMUT_REACH } from "./tables";

const SHAPE_REF = 2.090563;
const MONO_OFFSET_FRAC = 0.6;

const finite = Number.isFinite;

/** dt_st_compute_y_tm: SSTS, the 1/2.4 power and the contrast curve around the pivot. */
export function computeYTm(yScene: number, ctx: Context): number {
  if (ctx.ssts.n <= 0) return 0;
  let y = sstsFwd(ctx.ssts, yScene * ctx.exposureFactor) / ctx.ssts.nr;
  y = Math.pow(Math.max(y, 0), 1 / 2.4);
  y = Math.min(y, 1);
  if (ctx.contrast !== 1 || ctx.toePower !== 1 || ctx.shoulderPower !== 1) {
    const c = ctx.contrast;
    const p = ctx.contrastPivot;
    if (y <= p) {
      const t = p > 0 ? y / p : 0;
      const e = c * (ctx.toePower + (1 - ctx.toePower) * t);
      y = p * Math.pow(Math.max(y / p, 0), e);
    } else {
      const rp = 1 - p;
      const t = rp > 0 ? (1 - y) / rp : 0;
      const e = c * (ctx.shoulderPower + (1 - ctx.shoulderPower) * t);
      y = 1 - rp * Math.pow(Math.max((1 - y) / rp, 0), e);
    }
  }
  return y;
}

/** The curve the graph draws: computeYTm with the mid-tones power. */
export function toneCurve(yScene: number, ctx: Context): number {
  const y = computeYTm(yScene, ctx);
  return ctx.gamma !== 0 ? Math.pow(Math.min(Math.max(y, 0), 1), ctx.gammaPower) : y;
}

export function desatWeight(yNorm: number, hlDesat: number, threshold: number): number {
  if (hlDesat <= 0 || yNorm <= threshold) return 0;
  if (!finite(yNorm)) return 0;
  const t = Math.max(yNorm - threshold, 0) / yNorm;
  const x = Math.min(t * hlDesat, 1);
  return x * x;
}

function gamutCompress(rgb: number[], lc: Vec3): void {
  const luma = lc[0] * rgb[0] + lc[1] * rgb[1] + lc[2] * rgb[2];
  const anchor = luma > 1e-4 ? luma : 1;
  let t = 0;
  for (let c = 0; c < 3; c++) {
    if (rgb[c] < 0) {
      const denom = anchor - rgb[c];
      const ti = denom > 1e-6 ? -rgb[c] / denom : 1;
      if (ti > t) t = ti;
    } else if (rgb[c] > 1) {
      const denom = rgb[c] - anchor;
      const ti = denom > 1e-6 ? (rgb[c] - 1) / denom : 1;
      if (ti > t) t = ti;
    }
  }
  if (t <= 0) return;
  const blend = Math.min(t, 1);
  for (let c = 0; c < 3; c++) rgb[c] = (1 - blend) * rgb[c] + blend * anchor;
}

function outputGamutProtect(rgb: number[], fwd: readonly number[], inv: readonly number[]): void {
  const t0 = Math.max(fwd[0] * rgb[0] + fwd[1] * rgb[1] + fwd[2] * rgb[2], 0);
  const t1 = Math.max(fwd[3] * rgb[0] + fwd[4] * rgb[1] + fwd[5] * rgb[2], 0);
  const t2 = Math.max(fwd[6] * rgb[0] + fwd[7] * rgb[1] + fwd[8] * rgb[2], 0);
  rgb[0] = inv[0] * t0 + inv[1] * t1 + inv[2] * t2;
  rgb[1] = inv[3] * t0 + inv[4] * t1 + inv[5] * t2;
  rgb[2] = inv[6] * t0 + inv[7] * t1 + inv[8] * t2;
}

export function reachFromTable(h: number): number {
  if (!finite(h)) return 0;
  let hw = h % 360;
  if (hw < 0) hw += 360;
  const i0 = Math.trunc(hw);
  const i1 = (i0 + 1) % 360;
  const t = hw - i0;
  return GAMUT_REACH[i0] + t * (GAMUT_REACH[i1] - GAMUT_REACH[i0]);
}

export function chromaNorm(h: number): number {
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr);
  const b = Math.sin(hr);
  const a2 = a * a - b * b;
  const b2 = 2 * a * b;
  const a3 = 4 * a * a * a - 3 * a;
  const b3 = 3 * b - 4 * b * b * b;
  return 11.34072 * a + 16.46899 * a2 + 7.8838 * a3 + 14.66441 * b - 6.37224 * b2 + 9.19364 * b3 + 77.12896;
}

const WSUM = WHITE_X + 1 + WHITE_Z;
const WCX = WHITE_X / WSUM;
const WCZ = WHITE_Z / WSUM;

function degrees(dz: number, dx: number): number {
  let a = Math.atan2(dz, dx) * (180 / Math.PI);
  if (a < 0) a += 360;
  if (a >= 360) a -= 360;
  return a;
}

function boundaryAt(angle: number): number {
  const bin = Math.trunc(angle);
  const next = (bin + 1) % 360;
  const frac = angle - bin;
  return SPECTRAL_BOUNDARY[bin] + frac * (SPECTRAL_BOUNDARY[next] - SPECTRAL_BOUNDARY[bin]);
}

interface Chroma {
  x: number;
  z: number;
}

/** Piecewise-linear about 0.5 so the response keeps neutral at 0.5 whatever the pivot. */
function neutralFixed(r: number, u01: number, r05: number): number {
  return u01 <= 0.5 ? (0.5 * r) / Math.max(r05, 1e-4) : 0.5 + (0.5 * (r - r05)) / Math.max(1 - r05, 1e-4);
}

function chromaContrastSigmoid(xz: Chroma, yTm: number, ctx: Context): void {
  if (yTm <= 0) return;
  if (!finite(xz.x) || !finite(xz.z)) return;
  const sum = xz.x + yTm + xz.z;
  if (sum <= 0) return;
  const dx = xz.x / sum - WCX;
  const dz = xz.z / sum - WCZ;
  const maxDist = boundaryAt(degrees(dz, dx));
  if (maxDist <= 0) return;

  const u = Math.min(Math.max(dx / maxDist, -1), 1);
  const w = Math.min(Math.max(dz / maxDist, -1), 1);
  const u01 = 0.5 * (u + 1);
  const w01 = 0.5 * (w + 1);
  const rnu = neutralFixed(sigmoidResponse(u01, ctx.chromaX.gain, ctx.chromaX.shift), u01, ctx.chromaX.r05);
  const rnw = neutralFixed(sigmoidResponse(w01, ctx.chromaZ.gain, ctx.chromaZ.shift), w01, ctx.chromaZ.r05);

  const cx = WCX + (2 * rnu - 1) * maxDist;
  const cz = WCZ + (2 * rnw - 1) * maxDist;
  const yNew = 1 - cx - cz;
  if (yNew > 0) {
    const s = yTm / yNew;
    xz.x = cx * s;
    xz.z = cz * s;
  }
}

function spectralGamut(xz: Chroma, yTm: number, knee: number, steepness: number): void {
  if (yTm <= 0) return;
  if (!finite(xz.x) || !finite(xz.z)) return;
  const sum = xz.x + yTm + xz.z;
  if (sum <= 0) return;
  let cx = xz.x / sum;
  let cz = xz.z / sum;
  let dx = cx - WCX;
  let dz = cz - WCZ;
  let chromaSq = dx * dx + dz * dz;

  const maxDist = boundaryAt(degrees(dz, dx));
  const target = maxDist * 0.92;
  if (maxDist > 0 && chromaSq > target * target) {
    const chroma = Math.sqrt(chromaSq);
    const excess = chroma - target;
    const bsteep = Math.max(target * 0.05, 0.001);
    const compression = excess / (excess + bsteep);
    const scale = (chroma - compression * excess) / chroma;
    cx = WCX + scale * dx;
    cz = WCZ + scale * dz;
    const yNew = 1 - cx - cz;
    if (yNew > 0) {
      const s = yTm / yNew;
      xz.x = cx * s;
      xz.z = cz * s;
      dx = cx - WCX;
      dz = cz - WCZ;
      chromaSq = dx * dx + dz * dz;
    }
  }

  const angle = degrees(dz, dx);
  const shape = reachFromTable(angle) / Math.max(chromaNorm(angle), 1e-6);
  const kneeMod = knee * Math.sqrt(Math.max(shape / SHAPE_REF, 0));
  if (chromaSq > kneeMod * kneeMod) {
    const chroma = Math.sqrt(chromaSq);
    const excess = chroma - kneeMod;
    const compression = excess / (excess + steepness);
    const scale = (chroma - compression * excess) / chroma;
    const xNew = WCX + scale * dx;
    const zNew = WCZ + scale * dz;
    const yNew = 1 - xNew - zNew;
    if (yNew > 0) {
      const s = yTm / yNew;
      xz.x = xNew * s;
      xz.z = zNew * s;
    }
  }
}

/** dt_st_pipeline_eval: one Rec.2020 (D50) scene pixel to display RGB. */
export function pipelineEval(rgbIn: Vec3, ctx: Context): Vec3 {
  const M = INPUT_MATRIX;
  const [r, g, b] = rgbIn;
  const xAbs = M[0] * r + M[1] * g + M[2] * b;
  const yAbs = M[3] * r + M[4] * g + M[5] * b;
  const zAbs = M[6] * r + M[7] * g + M[8] * b;
  if (!(yAbs > 1e-10) || !finite(yAbs)) return [0, 0, 0];

  const xRatio = Math.min(Math.max(xAbs / yAbs, -100), 100);
  const zRatio = Math.min(Math.max(zAbs / yAbs, -100), 100);

  let yTm = computeYTm(yAbs, ctx);
  if (ctx.gamma !== 0) yTm = Math.pow(Math.min(Math.max(yTm, 0), 1), ctx.gammaPower);

  const xz: Chroma = { x: xRatio * yTm, z: zRatio * yTm };
  chromaContrastSigmoid(xz, yTm, ctx);
  spectralGamut(xz, yTm, ctx.gamutKnee, ctx.gamutSteepness);

  const yExposed = yAbs * ctx.exposureFactor;

  if (ctx.monochrome) {
    const xOff = xz.x - WHITE_X * yTm;
    const zOff = xz.z - WHITE_Z * yTm;
    let off = ctx.monoXGain * xOff + ctx.monoZGain * zOff;
    const lim = MONO_OFFSET_FRAC * yTm;
    const aOff = Math.abs(off);
    if (aOff > lim) {
      const soft = Math.max(lim * 0.5, 1e-6);
      const over = aOff - lim;
      const v = lim + (over / (over + soft)) * soft;
      off = off < 0 ? -v : v;
    }
    let grey = Math.max(yTm + off, 0);
    grey = finite(grey) ? grey : 0;
    const w = desatWeight(yExposed, ctx.hlDesat, ctx.hlDesatThreshold);
    if (w > 0 && finite(w)) {
      const ts = Math.min(w, 1);
      grey = grey * (1 - ts) + ts;
    }
    return [grey, grey, grey];
  }

  const O = OUTPUT_MATRIX;
  const rgb = [
    O[0] * xz.x + O[1] * yTm + O[2] * xz.z,
    O[3] * xz.x + O[4] * yTm + O[5] * xz.z,
    O[6] * xz.x + O[7] * yTm + O[8] * xz.z,
  ];
  const lc = ctx.lumaCoeff;

  if (ctx.hlRotation !== 0 && yAbs > 1e-10) {
    const compression = Math.min(yTm / (yAbs * ctx.exposureFactor), 1);
    const weight = Math.pow(1 - compression, 0.5);
    const angle = ctx.hlRotation * 0.8 * weight;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    if (finite(ca) && finite(sa)) {
      const y = lc[0] * rgb[0] + lc[1] * rgb[1] + lc[2] * rgb[2];
      const u = rgb[0] - y;
      const v = rgb[2] - y;
      const ur = u * ca - v * sa;
      const vr = u * sa + v * ca;
      let t = 1;
      if (ur > 0) t = Math.min(t, (1 - y) / ur);
      if (ur < 0) t = Math.min(t, -y / ur);
      if (vr > 0) t = Math.min(t, (1 - y) / vr);
      if (vr < 0) t = Math.min(t, -y / vr);
      if (lc[1] !== 0) {
        const gd = -(lc[0] * ur + lc[2] * vr) / lc[1];
        if (gd > 0) t = Math.min(t, (1 - y) / gd);
        if (gd < 0) t = Math.min(t, -y / gd);
      }
      t = Math.max(t, 0);
      rgb[0] = y + t * ur;
      rgb[2] = y + t * vr;
      if (lc[1] !== 0) rgb[1] = y - (lc[0] / lc[1]) * t * ur - (lc[2] / lc[1]) * t * vr;
    }
  }

  const w = desatWeight(yExposed, ctx.hlDesat, ctx.hlDesatThreshold);
  if (w > 0 && finite(w)) {
    const maxc = Math.max(rgb[0], rgb[1], rgb[2]);
    const minc = Math.min(rgb[0], rgb[1], rgb[2]);
    const sat = maxc > 0 ? (maxc - minc) / maxc : 0;
    const ss = (sat * sat) / (sat * sat + (1 - sat) * (1 - sat) + 1e-6);
    let wFinal = w;
    if (ctx.hlDesat > 0) {
      const vibNeg = ctx.hlDesat * ss * 0.35;
      wFinal = Math.min(wFinal + desatWeight(yExposed, 1, ctx.hlDesatThreshold) * vibNeg, 1);
    }
    const ts = Math.min(wFinal, 1);
    if (finite(ts)) for (let c = 0; c < 3; c++) rgb[c] = rgb[c] * (1 - ts) + ts;
  }

  if (ctx.vibrance !== 1) {
    const vib = Math.max(ctx.vibrance, 0);
    const luma = lc[0] * rgb[0] + lc[1] * rgb[1] + lc[2] * rgb[2];
    const maxc = Math.max(rgb[0], rgb[1], rgb[2]);
    const minc = Math.min(rgb[0], rgb[1], rgb[2]);
    const level = Math.max(maxc, Math.max(Math.abs(minc), Math.abs(luma)));
    const satNorm = level > 0 ? (maxc - minc) / level : 0;
    let gain = vib;
    if (vib > 1) {
      const p = 1 - Math.min(satNorm, 1);
      gain = 1 + (vib - 1) * (p * p);
    }
    for (let c = 0; c < 3; c++) rgb[c] = luma + gain * (rgb[c] - luma);
  }

  if (ctx.chromaticBoost > 0) {
    const luma = lc[0] * rgb[0] + lc[1] * rgb[1] + lc[2] * rgb[2];
    const maxc = Math.max(rgb[0], rgb[1], rgb[2]);
    const minc = Math.min(rgb[0], rgb[1], rgb[2]);
    const satM = maxc - minc;
    const level = Math.max(maxc, Math.max(Math.abs(minc), Math.abs(luma)));
    const satNorm = level > 0 ? satM / level : 0;
    const sigma = 1.85;
    const logRel = Math.log2(Math.max(yAbs / 0.18, 1e-10));
    const wGauss = Math.exp(-(logRel * logRel) / (2 * sigma * sigma));
    const wMid = logRel <= 0 ? 1 : 1.328 * wGauss - 0.328;
    const pp = 1 - Math.min(satNorm, 1);
    let hue = 0;
    if (satM > 0) {
      // C's fmodf keeps the dividend's sign, and |(g - b) / satM| <= 1 here, so it returns its argument.
      if (maxc === rgb[0]) hue = 60 * ((rgb[1] - rgb[2]) / satM);
      else if (maxc === rgb[1]) hue = 60 * ((rgb[2] - rgb[0]) / satM + 2);
      else hue = 60 * ((rgb[0] - rgb[1]) / satM + 4);
      if (hue < 0) hue += 360;
    }
    const hueMod = 1 + 0.1 * Math.cos(((hue - 60) * Math.PI) / 180);
    const gain = 1 + ctx.chromaticBoost * wMid * (pp * pp) * hueMod;
    for (let c = 0; c < 3; c++) rgb[c] = luma + gain * (rgb[c] - luma);
  }

  gamutCompress(rgb, lc);
  if (ctx.gamutEnable) outputGamutProtect(rgb, ctx.gamutFwd, ctx.gamutInv);

  return [
    finite(rgb[0]) ? Math.max(rgb[0], 0) : 0,
    finite(rgb[1]) ? Math.max(rgb[1], 0) : 0,
    finite(rgb[2]) ? Math.max(rgb[2], 0) : 0,
  ];
}

/** process()'s per-pixel body: sanitise, the pre-pipeline highlight roll-off
 *  toward the brightest channel, the pipeline and the colour look. */
export function processPixel(rgbIn: Vec3, ctx: Context, look: number, lookOpacity: number): Vec3 {
  const rgb = rgbIn.map((v) => (finite(v) ? Math.max(v, 0) : 0));
  const lum = Math.max(rgb[0], rgb[1], rgb[2]);
  const w = desatWeight(lum * ctx.exposureFactor, ctx.hlDesat, ctx.hlDesatThreshold);
  if (w > 0 && finite(w)) {
    const t = Math.min(w, 1);
    const ts = (t * t) / (t * t + (1 - t) * (1 - t) + 1e-6);
    if (finite(ts) && ts > 0) for (let c = 0; c < 3; c++) rgb[c] = rgb[c] * (1 - ts) + lum * ts;
  }
  const out = pipelineEval([rgb[0], rgb[1], rgb[2]], ctx);
  if (look < 1 || look > 10) return out;
  const m = COLOR_LOOKS.slice((look - 1) * 9, look * 9);
  const [r, g, b] = out;
  const mixed = [0, 1, 2].map((row) => {
    const t = r * m[row * 3] + g * m[row * 3 + 1] + b * m[row * 3 + 2];
    return Math.max(out[row] * (1 - lookOpacity) + t * lookOpacity, 0);
  });
  return [mixed[0], mixed[1], mixed[2]];
}

/** The whole transform before the display encoding: Safelight's linear
 *  Rec.709 into upstream's Rec.2020 working space, the module, and back. */
export function transformPixel(lin: Vec3, ctx: Context, look: number, lookOpacity: number): Vec3 {
  return apply(REC2020_TO_REC709, processPixel(apply(REC709_TO_REC2020, lin), ctx, look, lookOpacity));
}
