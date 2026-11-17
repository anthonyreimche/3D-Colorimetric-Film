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
// Transcribes libre-dt-lab src/iop/3dcf.c (ccb00d1b9): dt_st_ssts_init
// (L491-533), st_compute_spectral_boundary (L1226-1326) and
// st_compute_context (L1930-2088), in doubles where upstream mixes floats and
// doubles. The input matrix is fixed, so the output matrix, the white and the
// spectral boundary are constants.

import { invert, toMat3, type Mat3 } from "./colour/mat3";
import { MONOCHROME, type Params } from "./params";
import { GAMUT_FWD, GAMUT_INV, LUMA, REC2020_D50_TO_XYZ, SPECTRAL_LOCUS_XY } from "./tables";

export interface Ssts {
  s2: number;
  m2: number;
  g: number;
  t1: number;
  nr: number;
  n: number;
}

export interface ChromaAxis {
  gain: number;
  shift: number;
  /** The response at the neutral point, 0.5. */
  r05: number;
}

/** The pipeline's context (dt_st_context_t, L182-232), less the detail recovery. */
export interface Context {
  exposureFactor: number;
  contrast: number;
  contrastPivot: number;
  lumaCoeff: readonly [number, number, number];
  hlDesat: number;
  hlDesatThreshold: number;
  hlRotation: number;
  gamma: number;
  gammaPower: number;
  vibrance: number;
  chromaticBoost: number;
  gamutKnee: number;
  gamutSteepness: number;
  toePower: number;
  shoulderPower: number;
  gamutFwd: Mat3;
  gamutInv: Mat3;
  gamutEnable: boolean;
  ssts: Ssts;
  chromaX: ChromaAxis;
  chromaZ: ChromaAxis;
  monoXGain: number;
  monoZGain: number;
  monochrome: boolean;
}

const MONO_FILTER_K = 0.1;
const MONO_SIGMOID_GMAX = 4;

/** dt_st_ssts_init: the ACES 2.0 single-stage tone scale for a peak in nits. */
export function sstsInit(peakLuminance: number): Ssts {
  const nr = 100;
  const g = 1.15;
  const c = 0.18;
  const cd = 10.013;
  const wg = 0.14;
  const t1 = 0.04;
  const rHitMin = 128;
  const rHitMax = 896;
  const n = Math.max(peakLuminance, 1);
  const rHit = rHitMin + (rHitMax - rHitMin) * (Math.log(n / nr) / Math.log(10000 / 100));
  const m0 = n / nr;
  const m1 = 0.5 * (m0 + Math.sqrt(m0 * (m0 + 4 * t1)));
  const u = Math.pow(rHit / m1 / (rHit / m1 + 1), g);
  const m = m1 / u;
  const wi = Math.log(n / 100) / Math.log(2);
  const ct = (cd / nr) * (1 + wi * wg);
  const gIp = 0.5 * (ct + Math.sqrt(ct * (ct + 4 * t1)));
  const gIpp2 = -(m1 * Math.pow(gIp / m, 1 / g)) / (Math.pow(gIp / m, 1 / g) - 1);
  const w2 = c / gIpp2;
  const s2 = w2 * m1;
  const u2 = Math.pow(rHit / m1 / (rHit / m1 + w2), g);
  const m2 = m1 / u2;
  return { s2, m2, g, t1, nr, n };
}

/** dt_st_ssts_fwd: scene value to display nits. */
export function sstsFwd(p: Ssts, x: number): number {
  if (!(x > 0)) return 0;
  const f = p.m2 * Math.pow(x / (x + p.s2), p.g);
  const h = (f * f) / (f + p.t1);
  return h * p.nr;
}

/** The input matrix as upstream holds it: the double table read into floats. */
export const INPUT_MATRIX: Mat3 = toMat3(REC2020_D50_TO_XYZ.map(Math.fround));

const inverse = invert(INPUT_MATRIX);
if (!inverse) throw new Error("singular Rec.2020 matrix");
/** XYZ (D50) back to Rec.2020 (D50), the working space. */
export const OUTPUT_MATRIX: Mat3 = inverse;

const rowSum = (m: Mat3, r: number): number => m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2];

/** The white's chromaticity ratios X/Y and Z/Y: D50. */
export const WHITE_X = rowSum(INPUT_MATRIX, 0) / rowSum(INPUT_MATRIX, 1);
export const WHITE_Z = rowSum(INPUT_MATRIX, 2) / rowSum(INPUT_MATRIX, 1);

const angleBin = (dz: number, dx: number): number => {
  let angle = Math.atan2(dz, dx) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return Math.min(359, Math.max(0, Math.trunc(angle)));
};

/** st_compute_spectral_boundary: per degree of hue around the white, the
 *  farthest CIE xz distance of the spectral locus and the purple line. */
export function spectralBoundary(whiteX: number, whiteZ: number): number[] {
  const wsum = whiteX + 1 + whiteZ;
  const wcx = whiteX / wsum;
  const wcz = whiteZ / wsum;
  const boundary = new Array<number>(360).fill(0);
  const add = (x: number, y: number) => {
    const z = 1 - x - y;
    const dx = x - wcx;
    const dz = z - wcz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const bin = angleBin(dz, dx);
    if (dist > boundary[bin]) boundary[bin] = dist;
  };
  const n = SPECTRAL_LOCUS_XY.length / 2;
  for (let i = 0; i < n; i++) add(SPECTRAL_LOCUS_XY[2 * i], SPECTRAL_LOCUS_XY[2 * i + 1]);

  const xr = SPECTRAL_LOCUS_XY[2 * (n - 1)];
  const yr = SPECTRAL_LOCUS_XY[2 * (n - 1) + 1];
  const xb = SPECTRAL_LOCUS_XY[0];
  const yb = SPECTRAL_LOCUS_XY[1];
  const Xr = xr / yr;
  const Zr = (1 - xr - yr) / yr;
  const Xb = xb / yb;
  const Zb = (1 - xb - yb) / yb;
  const NSEG = 32;
  for (let i = 1; i <= NSEG; i++) {
    const t = i / (NSEG + 1);
    const X = Xr + t * (Xb - Xr);
    const Z = Zr + t * (Zb - Zr);
    const sum = X + 1 + Z;
    add(X / sum, 1 / sum);
  }

  let last = 0;
  for (let i = 0; i < 360; i++) {
    if (boundary[i] > 0) last = boundary[i];
    else if (last > 0) boundary[i] = last;
  }
  last = 0;
  for (let i = 359; i >= 0; i--) {
    if (boundary[i] > 0) last = boundary[i];
    else if (last > 0) boundary[i] = last;
  }
  let minNonzero = 1e6;
  for (const b of boundary) if (b > 0 && b < minNonzero) minNonzero = b;
  if (minNonzero > 1e5) minNonzero = 1;
  return boundary.map((b) => (b <= 0 ? minNonzero : b));
}

export const SPECTRAL_BOUNDARY: readonly number[] = spectralBoundary(WHITE_X, WHITE_Z);

/** st_chroma_contrast_sigmoid's normalised response, r(0) = 0 and r(1) = 1:
 *  (s(u) - s(0)) / (s(1) - s(0)) for s(x) = 1 / (1 + e^(-gain (x - shift))).
 *  Upstream subtracts the sigmoids in floats; at chroma contrast 0 the gain
 *  is held at 1e-4, the sigmoids differ by 2.5e-5 and the float difference
 *  keeps about two significant digits. Rewritten with expm1, the same
 *  function is exact at any gain:
 *  expm1(-gain u) / expm1(-gain) * (1 + e^(-gain (1 - shift))) / (1 + e^(-gain (u - shift))). */
export function sigmoidResponse(u: number, gain: number, shift: number): number {
  return (Math.expm1(-gain * u) / Math.expm1(-gain)) * ((1 + Math.exp(-gain * (1 - shift))) / (1 + Math.exp(-gain * (u - shift))));
}

/** gain, shift and the response at the neutral point. */
function chromaAxis(gain: number, pivot: number): ChromaAxis {
  const shift = pivot / 100;
  return { gain, shift, r05: sigmoidResponse(0.5, gain, shift) };
}

const matAt = (table: readonly number[], i: number): Mat3 => toMat3(table.slice(i * 9, i * 9 + 9));

/** st_compute_context, from params already held to their ranges. */
export function computeContext(p: Params): Context {
  const mono = p.color_look === MONOCHROME;
  const cs = p.output_cs >= 0 && p.output_cs <= 4 ? p.output_cs : 1;

  const rawX = Math.max(p.chroma_x_contrast, 1e-4);
  const rawZ = Math.max(p.chroma_z_contrast, 1e-4);
  const gx = mono ? Math.min(rawX, MONO_SIGMOID_GMAX) : rawX;
  const gz = mono ? Math.min(rawZ, MONO_SIGMOID_GMAX) : rawZ;
  const green = mono ? MONO_FILTER_K * p.mono_green : 0;

  const gamma = -Math.max(Math.min(p.gamma, 1), -1);

  return {
    exposureFactor: Math.pow(2, p.input_exposure),
    contrast: Math.max(p.contrast, 0.001),
    contrastPivot: 1 - Math.max(Math.min(p.contrast_pivot, 0.99), 0.01),
    lumaCoeff: LUMA[cs],
    hlDesat: Math.max(p.hl_desaturation, 0),
    hlDesatThreshold: Math.max(p.hl_desat_threshold, 0),
    hlRotation: p.hl_hue_shift,
    gamma,
    gammaPower: Math.pow(2, gamma),
    vibrance: Math.max(p.vibrance, 0),
    chromaticBoost: Math.max(p.chromatic_boost, 0),
    gamutKnee: Math.max(p.gamut_knee, 0),
    gamutSteepness: Math.max(p.gamut_steepness, 1e-6),
    toePower: Math.max(p.toe_power, 0),
    shoulderPower: Math.max(p.shoulder_power, 0),
    gamutFwd: matAt(GAMUT_FWD, cs),
    gamutInv: matAt(GAMUT_INV, cs),
    gamutEnable: cs !== 1,
    ssts: sstsInit(200 * (1 + p.peak_luminance / 100)),
    chromaX: chromaAxis(gx, p.chroma_x_pivot),
    chromaZ: chromaAxis(gz, p.chroma_z_pivot),
    monoXGain: mono ? MONO_FILTER_K * rawX - green : 0,
    monoZGain: mono ? MONO_FILTER_K * rawZ - green : 0,
    monochrome: mono,
  };
}
