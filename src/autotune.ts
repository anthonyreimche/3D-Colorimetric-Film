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
// Transcribes libre-dt-lab src/iop/3dcf.c (ccb00d1b9) auto_adjust_3dcf_params
// with its presets and st_auto_eval_y_tm (L621-961). Upstream measures the
// module's input under a grey-point picker, or the whole preview without a
// pick; here it measures the scene the transform receives over what the view
// shows, as upstream does without a pick.

import { INPUT_MATRIX, sstsFwd, sstsInit } from "./context";
import type { Params } from "./params";
import type { FloatFrame, SafelightAPI } from "./safelight";

export const AUTO_MODES = ["Contrasty", "Neutral", "Soft"] as const;
export type AutoMode = 0 | 1 | 2;

interface AutoPreset {
  targetSd: number;
  gain: number;
  contrastMin: number;
  contrastMax: number;
  toeBase: number;
  toeAmplitude: number;
  shoulderAmplitude: number;
}

const PRESETS: readonly AutoPreset[] = [
  { targetSd: 1.8, gain: 1.0, contrastMin: 0.6, contrastMax: 3.5, toeBase: 1.15, toeAmplitude: -0.4, shoulderAmplitude: 0.4 },
  { targetSd: 1.8, gain: 0.88, contrastMin: 0.7, contrastMax: 3.1, toeBase: 1.08, toeAmplitude: -0.35, shoulderAmplitude: 0.35 },
  { targetSd: 1.8, gain: 0.78, contrastMin: 0.8, contrastMax: 2.8, toeBase: 1.0, toeAmplitude: -0.3, shoulderAmplitude: 0.3 },
];

const BINS = 2048;
const EV_MIN = -20;
const EV_MAX = 16;
const HL_PERCENTILE = 0.99;
const HEADROOM = 0.92;
const GREY = 0.18;

/** The tone scale alone, without the contrast curve, at a peak in nits. */
function evalYTm(yScene: number, peakNits: number): number {
  const ssts = sstsInit(peakNits);
  const y = sstsFwd(ssts, yScene) / ssts.nr;
  return Math.min(Math.pow(Math.max(y, 0), 1 / 2.4), 1);
}

const percentToNits = (percent: number): number => 200 * (1 + percent / 100);
const nitsToPercent = (nits: number): number => (nits / 200 - 1) * 100;
const clamp = (x: number, lo: number, hi: number): number => Math.max(Math.min(x, hi), lo);

export type AutoResult = Pick<Params, "input_exposure" | "peak_luminance" | "contrast_pivot" | "contrast" | "toe_power" | "shoulder_power">;

/** auto_adjust_3dcf_params: exposure from the trimmed geometric mean, peak
 *  luminance so the 99th percentile lands under clipping, the pivot where grey
 *  lands, and contrast, toe and shoulder from the spread on each side of grey.
 *  `pixels` is RGBA, Rec.2020 scene-linear; `pickedGrey` > 0 anchors the
 *  exposure on that luminance. Null for a frame with nothing above black. */
export function autoAdjust(pixels: ArrayLike<number>, count: number, mode: AutoMode, pickedGrey = 0): AutoResult | null {
  const preset = PRESETS[mode];
  const [lr, lg, lb] = [INPUT_MATRIX[3], INPUT_MATRIX[4], INPUT_MATRIX[5]];
  const step = count > 1_000_000 ? 4 : 1;
  const lumaAt = (i: number): number => lr * pixels[4 * i] + lg * pixels[4 * i + 1] + lb * pixels[4 * i + 2];

  const hist = new Uint32Array(BINS);
  const scale = BINS / (EV_MAX - EV_MIN);
  let samples = 0;
  for (let i = 0; i < count; i += step) {
    const y = lumaAt(i);
    if (y > 1e-6) {
      samples++;
      const bin = Math.trunc((Math.log2(y) - EV_MIN) * scale);
      hist[clamp(bin, 0, BINS - 1)]++;
    }
  }
  if (samples === 0) return null;

  const lowTrim = Math.trunc(samples * 0.15);
  const highTrim = Math.trunc(samples * 0.95);
  const hlCount = Math.trunc(samples * HL_PERCENTILE);
  let sumEv = 0;
  let trimmed = 0;
  let hiBin = BINS - 1;
  let hiFound = false;
  let cumulative = 0;
  for (let b = 0; b < BINS; b++) {
    const n = hist[b];
    if (n === 0) continue;
    const start = cumulative;
    cumulative += n;
    if (cumulative > lowTrim && start < highTrim) {
      let valid = n;
      if (start < lowTrim) valid -= lowTrim - start;
      if (cumulative > highTrim) valid -= cumulative - highTrim;
      sumEv += valid * (EV_MIN + (b + 0.5) / scale);
      trimmed += valid;
    }
    if (!hiFound && cumulative >= hlCount) {
      hiBin = b;
      hiFound = true;
    }
  }

  const sceneGrey = pickedGrey > 1e-6 ? pickedGrey : trimmed > 0 ? Math.pow(2, sumEv / trimmed) : GREY;
  const evShift = Math.log2(GREY / sceneGrey);
  const inputExposure = clamp(evShift, -2, 2);

  const yHigh = Math.pow(2, EV_MIN + (hiBin + 0.5) / scale + evShift);
  let peakNits: number;
  let lo = 1;
  let hi = 400;
  if (evalYTm(yHigh, hi) <= HEADROOM) peakNits = 200;
  else if (evalYTm(yHigh, lo) >= HEADROOM) peakNits = lo;
  else {
    for (let it = 0; it < 24; it++) {
      const mid = 0.5 * (lo + hi);
      if (evalYTm(yHigh, mid) > HEADROOM) hi = mid;
      else lo = mid;
    }
    peakNits = 0.5 * (lo + hi);
  }
  const peakLuminance = clamp(nitsToPercent(peakNits), -100, 100);
  const contrastPivot = clamp(1 - evalYTm(GREY, percentToNits(peakLuminance)), 0.01, 0.99);

  const logPivot = Math.log2(GREY);
  const exposure = Math.pow(2, evShift);
  let sumSq = 0;
  let n = 0;
  let sumShadow = 0;
  let nShadow = 0;
  let sumHighlight = 0;
  let nHighlight = 0;
  for (let i = 0; i < count; i += step) {
    const y = lumaAt(i) * exposure;
    if (y > 1e-3) {
      const d = Math.log2(y) - logPivot;
      sumSq += d * d;
      n++;
      if (d < 0) {
        sumShadow += d * d;
        nShadow++;
      } else {
        sumHighlight += d * d;
        nHighlight++;
      }
    }
  }
  const sd = n > 0 ? Math.sqrt(sumSq / n) : 1.5;
  const sdShadow = nShadow > 0 ? Math.sqrt(sumShadow / nShadow) : preset.targetSd;
  const sdHighlight = nHighlight > 0 ? Math.sqrt(sumHighlight / nHighlight) : preset.targetSd;

  const contrast = clamp(preset.gain * 2.25 * (preset.targetSd / Math.max(sd, 0.4)), preset.contrastMin, preset.contrastMax);
  const tShadow = clamp((sdShadow - 1.2) / (2.5 - 1.2), 0, 1);
  const tHighlight = clamp((sdHighlight - 1.2) / (2.5 - 1.2), 0, 1);
  return {
    input_exposure: inputExposure,
    peak_luminance: peakLuminance,
    contrast_pivot: contrastPivot,
    contrast,
    toe_power: preset.toeBase - preset.toeAmplitude * tShadow,
    shoulder_power: preset.toeBase - preset.shoulderAmplitude * tHighlight,
  };
}

export const SCENE_SPACE = { encoding: "linear", primaries: "rec2020" } as const;

/** The scene the display transform receives, over what the view shows, in
 *  linear Rec.2020 (upstream's working space). */
export async function captureScene(host: SafelightAPI): Promise<FloatFrame | "unsupported" | "no frame"> {
  if (!host.develop.captureFloatFrame) return "unsupported";
  const params = host.stores.useDevelopStore.getState().params;
  const frame = await host.develop.captureFloatFrame(params, { point: "scene", space: SCENE_SPACE });
  if (!frame) return "no frame";
  // The frame names its point; any other is not the scene.
  if (frame.point !== "scene") return "unsupported";
  return frame;
}

