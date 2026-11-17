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
// The panel's sliders as libre-dt-lab's gui_init lays them out
// (src/iop/3dcf.c L4147-4485, ccb00d1b9): each shows value * scale + offset,
// as its bauhaus factor and offset do, over the param's whole range. Labels
// are capitalised and tooltips joined into sentences; the monochrome look's
// relabelling of the X/Z sliders follows _chroma_set_visibility (L3205-3282).

import type { Params } from "../params";

type Key = keyof Params & string;

export interface SliderSpec {
  key: Key;
  label: string;
  tooltip: string;
  unit: "%" | "EV";
  scale: number;
  offset: number;
  step: number;
}

const pct = (key: Key, label: string, tooltip: string, scale = 100, offset = 0, step = 1): SliderSpec => ({
  key,
  label,
  tooltip,
  unit: "%",
  scale,
  offset,
  step,
});

export const TONE: readonly SliderSpec[] = [
  {
    key: "input_exposure",
    label: "Input exposure",
    tooltip:
      "Exposure before the tone scale, in EV. Positive values brighten the image and push more signal into the tone scale; negative values darken it. 0 EV leaves the reference exposure.",
    unit: "EV",
    scale: 1,
    offset: 0,
    step: 0.05,
  },
  pct(
    "peak_luminance",
    "Peak luminance",
    "The tone scale's peak luminance. 0% is 200 nits, the reference; -100% the softest, +100% 400 nits. Lower values give more highlight headroom with a gentler roll-off; higher values clip earlier.",
    1,
  ),
  pct(
    "contrast",
    "Contrast",
    "S-curve contrast around the pivot. -100% is the least contrast, 0% neutral, +100% the most. Negative values soften, positive values sharpen.",
    50,
    -112.5,
  ),
  pct(
    "contrast_pivot",
    "Contrast pivot",
    "The fulcrum of the contrast S-curve. Higher values shift it toward the shadows and brighten the image; lower values shift it toward the highlights and darken it.",
    100,
    -50,
  ),
  pct(
    "shoulder_power",
    "Shoulder power",
    "Highlight contrast relative to the main contrast. 0% matches it, -100% removes contrast in the highlights, +100% doubles it.",
    100,
    -100,
    0.1,
  ),
  pct(
    "toe_power",
    "Toe power",
    "Shadow contrast relative to the main contrast. 0% matches it, -100% removes contrast in the shadows, +100% doubles it.",
    100,
    -100,
    0.1,
  ),
  pct("gamma", "Mid-tones", "Gamma of the tone curve. Moving right (+100%) brightens the image, moving left (-100%) darkens it."),
];

export const LOOK_OPACITY = pct("look_opacity", "Look opacity", "The strength of the colour look.");
export const VIBRANCE = pct("vibrance", "Vibrance", "Smart saturation: boosts pastels while protecting colours that are already saturated.", 100, -100);
export const CHROMATIC_BOOST = pct("chromatic_boost", "Chromatic boost", "Accentuates the colour of the mid-tones, with a slight hue contrast in the highlights.");
export const ABNEY = pct(
  "hl_hue_shift",
  "Abney rotation",
  "Hue rotation in the highlights, tied to how hard the tone scale compresses them. Positive values rotate toward cool (blue), negative toward warm (salmon). It ramps up as highlights compress, up to about 23° on clipped highlights; mid-tones and shadows stay untouched. Independent of the highlight roll-off.",
);
export const GREEN_FILTER = pct(
  "mono_green",
  "Green filter",
  "Green filter for the monochrome look: takes an equal amount from the warm (red) X and cool (blue) Z filters, brightening green tones while darkening red and blue. 0% is off (neutral panchromatic grey).",
  10,
  0,
  0.1,
);

/** The X/Z sliders, labelled for a colour look or for the monochrome one, locked or not. */
export function chromaSliders(mono: boolean, locked: boolean): { x: SliderSpec; xPivot: SliderSpec; z: SliderSpec; zPivot: SliderSpec; balance: Omit<SliderSpec, "key"> } {
  const contrast = (key: Key, label: string, tooltip: string) => pct(key, label, tooltip, 10, 0, 0.1);
  const pivot = (key: Key, label: string, tooltip: string) => pct(key, label, tooltip, 1, -50, 0.1);
  if (mono) {
    return {
      x: contrast(
        "chroma_x_contrast",
        locked ? "Warm/cool filter strength" : "Warm (red) filter",
        locked
          ? "Monochrome filter strength on both the warm (red) and cool (blue) chroma axes before the grey is taken. 0% is neutral panchromatic grey; the balance splits the effect between the two axes. Unlock X and Z to drive warm and cool on their own."
          : "Monochrome filter on the warm (red) X chroma axis before the grey is taken. 0% is neutral panchromatic grey; higher values brighten warm/red tones and darken cool/blue ones.",
      ),
      z: contrast(
        "chroma_z_contrast",
        "Cool (blue) filter",
        "Monochrome filter on the cool (blue) Z chroma axis before the grey is taken. 0% is neutral; higher values brighten cool/blue tones and darken warm/red ones.",
      ),
      xPivot: pivot("chroma_x_pivot", "Warm filter neutral point", "Neutral point of the warm (red) filter, relative to the symmetric position (0% is symmetric)."),
      zPivot: pivot("chroma_z_pivot", "Cool filter neutral point", "Neutral point of the cool (blue) filter, relative to the symmetric position (0% is symmetric)."),
      balance: {
        label: "Warm/cool balance",
        tooltip:
          "How the balance splits the monochrome filter strength: the favoured axis keeps the full strength, the other is reduced in proportion. 0% is symmetric, +100% warm only, -100% cool only.",
        unit: "%",
        scale: 100,
        offset: 0,
        step: 1,
      },
    };
  }
  return {
    x: contrast(
      "chroma_x_contrast",
      locked ? "Chroma contrast" : "X-axis chroma contrast",
      "Contrast on the CIE X chroma offset from white, applied right after the chromaticity is scaled and before the gamut roll-off. 0% is off.",
    ),
    z: contrast(
      "chroma_z_contrast",
      "Z-axis chroma contrast",
      "Contrast on the CIE Z chroma offset from white, applied right after the chromaticity is scaled and before the gamut roll-off. 0% is off.",
    ),
    xPivot: pivot("chroma_x_pivot", "X-axis contrast pivot", "Pivot of the X-axis chroma contrast, relative to the symmetric position (0% is symmetric)."),
    zPivot: pivot("chroma_z_pivot", "Z-axis contrast pivot", "Pivot of the Z-axis chroma contrast, relative to the symmetric position (0% is symmetric)."),
    balance: {
      label: "X/Z balance",
      tooltip:
        "How the balance splits the chroma contrast: the favoured axis keeps the full strength, the other is reduced in proportion. 0% is symmetric (X = Z), +100% X only, -100% Z only.",
      unit: "%",
      scale: 100,
      offset: 0,
      step: 1,
    },
  };
}

export const HIGHLIGHTS: readonly SliderSpec[] = [
  pct(
    "hl_desaturation",
    "Highlight roll-off",
    "Highlight roll-off: desaturates bright areas toward white, harder on saturated colours. 0% is off, 15% a natural roll-off, 100% the most.",
  ),
  pct(
    "hl_detail_recovery",
    "Detail recovery",
    "Restores local contrast in the highlights that the tone mapping smoothed: a guided filter separates the original luminance's detail, which is put back after the tone mapping with gain compensation. 0% is off, 100% full recovery.",
  ),
  pct(
    "hl_desat_threshold",
    "Desaturation threshold",
    "The luminance at which the highlight roll-off begins. Lower values desaturate earlier; higher values keep saturation longer.",
  ),
];

export const GAMUT: readonly SliderSpec[] = [
  pct("gamut_knee", "Gamut knee", "Where the chroma roll-off starts. Lower values start compressing earlier."),
  pct("gamut_steepness", "Gamut steepness", "How soft the chroma roll-off is. Higher values ease more gradually toward the gamut boundary."),
];

export const TOOLTIPS = {
  look: "A colour style for the image.",
  target:
    "The display the image is meant for: its luma weights the vibrance and the highlight bleaching, and colours outside its primaries are pulled in. sRGB is the narrowest, Rec. 2020 the widest (nothing pulled in).",
  lock: "Lock the X and Z axes: one strength drives both, split by the balance, and the Z pivot follows the X pivot.",
  reset: "Reset the X/Z chroma sliders (contrast and pivot) to their defaults.",
  auto: "Measures the scene and sets the input exposure, peak luminance, contrast pivot, contrast, toe and shoulder, in the contrast rendering chosen beside it. Exposure, peak and pivot are the same for each rendering; only the contrast differs.",
  mode: "The contrast rendering auto adjust uses.",
} as const;
