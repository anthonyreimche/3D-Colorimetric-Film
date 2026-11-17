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
// The X/Z chroma lock as pure functions of the params. Transcribes
// libre-dt-lab src/iop/3dcf.c (ccb00d1b9) _chroma_balance_from_xz,
// _chroma_z_from_x (L3175-3188), _chroma_x_changed (L4036-4053),
// _chroma_balance_changed (L4074-4122) and _chroma_reset_clicked
// (L4129-4145). The lock and the balance are view state, not params.

import type { Params } from "../params";

// darktable's CLAMPF (common/math.h): NaN goes to the low bound.
const clampf = (a: number, lo: number, hi: number): number => (a >= lo ? (a <= hi ? a : hi) : lo);

/** The split of a shared strength S between the axes: b >= 0 keeps X = S and
 *  Z = S (1 - b); b < 0 keeps Z = S and X = S (1 + b). This is its inverse. */
export function balanceFromXZ(x: number, z: number): number {
  if (x >= z) return x > 1e-6 ? clampf(1 - z / x, -1, 1) : 0;
  return z > 1e-6 ? clampf(x / z - 1, -1, 1) : 0;
}

export function zFromX(x: number, balance: number): number {
  return balance >= 0 ? clampf(x * (1 - balance), 0, 10) : clampf(x / Math.max(1 + balance, 1e-3), 0, 10);
}

type ChromaPatch = Partial<Pick<Params, "chroma_x_contrast" | "chroma_z_contrast" | "chroma_x_pivot" | "chroma_z_pivot">>;

/** While locked, the X sliders drive both axes: Z follows X at the balance,
 *  and the Z pivot follows the X pivot. Other edits pass unchanged. */
export function lockedEdit(from: Params, patch: Partial<Params>, balance: number): Partial<Params> {
  if (patch.chroma_x_contrast === undefined && patch.chroma_x_pivot === undefined) return patch;
  const next = { ...from, ...patch };
  return { ...patch, chroma_z_contrast: zFromX(next.chroma_x_contrast, balance), chroma_z_pivot: next.chroma_x_pivot };
}

/** The balance slider: the larger axis's strength split by `balance`, the Z pivot on the X pivot. */
export function balanceEdit(from: Params, balance: number): ChromaPatch {
  const s = Math.max(from.chroma_x_contrast, from.chroma_z_contrast);
  return {
    chroma_x_contrast: s * Math.min(1, 1 + balance),
    chroma_z_contrast: s * Math.min(1, 1 - balance),
    chroma_z_pivot: from.chroma_x_pivot,
  };
}

/** The reset button by the X pivot and the balance: both axes back to their defaults. */
export const CHROMA_RESET: Required<ChromaPatch> = {
  chroma_x_contrast: 0,
  chroma_z_contrast: 0,
  chroma_x_pivot: 50,
  chroma_z_pivot: 50,
};
