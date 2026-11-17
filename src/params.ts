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
// The fields of dt_iop_3dcf_params_t v11 (libre-dt-lab src/iop/3dcf.c
// L133-168, ccb00d1b9) with their $MIN, $MAX and $DEFAULT.

import { defaults, type ParamTable, type ParamValues } from "./param-table";

export const PARAMS = {
  contrast: { type: "float", default: 2.25, min: 0.25, max: 4.25, label: "contrast" },
  gamma: { type: "float", default: 0, min: -1, max: 1, label: "mid-tones" },
  vibrance: { type: "float", default: 1, min: 0, max: 2, label: "vibrance" },
  chromatic_boost: { type: "float", default: 0, min: 0, max: 1, label: "chromatic boost" },
  peak_luminance: { type: "float", default: 0, min: -100, max: 100, label: "peak luminance" },
  input_exposure: { type: "float", default: 0, min: -2, max: 2, label: "input exposure" },
  hl_hue_shift: { type: "float", default: 0, min: -1, max: 1, label: "Abney rotation" },
  hl_desaturation: { type: "float", default: 0.25, min: 0, max: 1, label: "highlight roll-off" },
  hl_desat_threshold: { type: "float", default: 0.5, min: 0, max: 1, label: "desaturation threshold" },
  gamut_knee: { type: "float", default: 0.2, min: 0, max: 1, label: "gamut knee" },
  gamut_steepness: { type: "float", default: 0.5, min: 0, max: 1, label: "gamut steepness" },
  output_cs: { type: "int", default: 1, min: 0, max: 4, label: "display target" },
  color_look: { type: "int", default: 0, min: 0, max: 11, label: "colour look" },
  look_opacity: { type: "float", default: 1, min: 0, max: 1, label: "look opacity" },
  contrast_pivot: { type: "float", default: 0.5, min: 0.01, max: 0.99, label: "contrast pivot" },
  toe_power: { type: "float", default: 1, min: 0.25, max: 3, label: "toe power" },
  shoulder_power: { type: "float", default: 1, min: 0.25, max: 3, label: "shoulder power" },
  hl_detail_recovery: { type: "float", default: 0.2, min: 0, max: 1, label: "detail recovery" },
  chroma_x_contrast: { type: "float", default: 0, min: 0, max: 10, label: "X-axis chroma contrast" },
  chroma_x_pivot: { type: "float", default: 50, min: 25, max: 75, label: "X-axis contrast pivot" },
  chroma_z_contrast: { type: "float", default: 0, min: 0, max: 10, label: "Z-axis chroma contrast" },
  chroma_z_pivot: { type: "float", default: 50, min: 25, max: 75, label: "Z-axis contrast pivot" },
  mono_green: { type: "float", default: 0, min: 0, max: 10, label: "green filter" },
} as const satisfies ParamTable;

export type Params = ParamValues<typeof PARAMS>;

export const DEFAULTS: Params = defaults(PARAMS);

/** output_cs, in the combobox order (dt_iop_st_colorspace_t, L95-102). */
export const DISPLAY_TARGETS = ["sRGB", "Rec. 2020", "Display P3", "ProPhoto RGB", "Adobe RGB"] as const;

/** color_look, in the combobox order (dt_iop_st_look_t, L110-124). */
export const COLOR_LOOK_NAMES = [
  "Neutral",
  "Natural look",
  "Portrait",
  "Vibrant",
  "Nature",
  "Blue sky",
  "Soft warm",
  "Soft",
  "Deep cool",
  "Authentic cinema",
  "Bright atmosphere",
  "Monochrome",
] as const;

export const MONOCHROME = 11;
