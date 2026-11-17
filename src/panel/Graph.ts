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
// The curve view of libre-dt-lab's _draw_curve (src/iop/3dcf.c L3364-3665,
// ccb00d1b9): scene exposure from -6 to +4 EV around mid-grey against display
// output, with the tone scale alone (faint), with the contrast curve, and with
// the mid-tones (solid); markers at grey, -3 and +2 EV; the pivot's level.

import type { ReactElement } from "react";
import { computeContext, sstsFwd, type Context } from "../context";
import type { Params } from "../params";
import { api, h } from "../runtime";
import { computeYTm, toneCurve } from "../twin";

export const EV_MIN = -6;
export const EV_MAX = 4;
const STEPS = 200;

export interface GraphData {
  /** Each curve as [x, y] in 0..1, x across the EV range. */
  ssts: [number, number][];
  contrast: [number, number][];
  full: [number, number][];
  markers: [number, number][];
  pivot: number;
}

const unit = (y: number): number => Math.min(Math.max(y, 0), 1);
const xOf = (ev: number): number => (ev - EV_MIN) / (EV_MAX - EV_MIN);

function sample(f: (yScene: number) => number): [number, number][] {
  return Array.from({ length: STEPS + 1 }, (_, k): [number, number] => {
    const ev = EV_MIN + ((EV_MAX - EV_MIN) * k) / STEPS;
    return [xOf(ev), unit(f(0.18 * 2 ** ev))];
  });
}

export function graphData(p: Params): GraphData {
  const ctx: Context = computeContext(p);
  return {
    ssts: sample((y) => Math.pow(Math.max(sstsFwd(ctx.ssts, y * ctx.exposureFactor) / ctx.ssts.nr, 0), 1 / 2.4)),
    contrast: sample((y) => computeYTm(y, ctx)),
    full: sample((y) => toneCurve(y, ctx)),
    markers: [0, -3, 2].map((ev): [number, number] => [xOf(ev), unit(toneCurve(0.18 * 2 ** ev, ctx))]),
    pivot: ctx.contrastPivot,
  };
}

const W = 160;
const H = 100;

export function CurveGraph({ p }: { p: Params }): ReactElement {
  const t = api().ui.tokens;
  const d = graphData(p);
  const pt = ([x, y]: [number, number]) => `${(x * W).toFixed(2)},${((1 - y) * H).toFixed(2)}`;
  const line = (points: [number, number][], opacity: number, width: number, stroke = t.textPrimary) =>
    h("polyline", { points: points.filter(([, y]) => Number.isFinite(y)).map(pt).join(" "), fill: "none", stroke, strokeOpacity: opacity, strokeWidth: width });
  const guides = [
    ...[0.25, 0.5, 0.75].map((y) => h("line", { key: `y${y}`, x1: 0, x2: W, y1: (1 - y) * H, y2: (1 - y) * H, stroke: t.border, strokeWidth: 0.4, strokeDasharray: "2 2" })),
    ...Array.from({ length: EV_MAX - EV_MIN - 1 }, (_, i) => EV_MIN + 1 + i).map((ev) =>
      h("line", { key: `x${ev}`, x1: xOf(ev) * W, x2: xOf(ev) * W, y1: 0, y2: H, stroke: t.border, strokeWidth: ev === 0 ? 0.7 : 0.4, strokeDasharray: "2 2" }),
    ),
  ];
  return h(
    "svg",
    {
      viewBox: `0 0 ${W} ${H}`,
      role: "img",
      "aria-label": "Tone curve",
      style: { width: "100%", aspectRatio: `${W} / ${H}`, background: t.surface0, border: `1px solid ${t.border}`, borderRadius: 4 },
    },
    ...guides,
    h("line", { x1: 0, x2: W, y1: (1 - d.pivot) * H, y2: (1 - d.pivot) * H, stroke: t.accent, strokeOpacity: 0.5, strokeWidth: 0.6, strokeDasharray: "3 2" }),
    line(d.ssts, 0.3, 0.8),
    line(d.contrast, 0.55, 1),
    line(d.full, 1, 1.4, t.accent),
    ...d.markers.map(([x, y], i) => h("circle", { key: `m${i}`, cx: x * W, cy: (1 - y) * H, r: i === 0 ? 2.2 : 1.5, fill: i === 0 ? t.accent : t.textSecondary })),
  );
}
