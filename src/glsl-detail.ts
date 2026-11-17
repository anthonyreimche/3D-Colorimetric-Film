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
// The detail recovery's guided filter as the transform's pre-pass, the GPU
// twin of detail.ts guidedCoefficients: four separable box draws over the
// pre-pass resolution. Its last draw leaves the box-filtered coefficients
// (a, b) for the transform, which takes base = a p + b at its own pixel.
//
// The ping-pong targets hold half floats, where a mean of p² less the
// square of a mean of p cancels on bright areas, so the first draw keeps the
// moments of p about each pixel's own luminance, and the second moves each
// row's moments to the centre pixel's (fetchInput gives every row's centre)
// before taking the variance.
//
// The radius is upstream's, in pixels of the full image, scaled to the
// passes' resolution; the tap past a fractional radius takes its fraction.

import { REC709_TO_REC2020 } from "./colour/profiles";
import type { StagePass, UniformDeclaration } from "./safelight";
import { GUIDED_EPS } from "./detail";
import { glslFloat, glslMat3 } from "./glsl";
import { LUMA } from "./tables";

const lumaRows = LUMA.map((l, i) => `  ${i === 0 ? "" : "else "}if (cs == ${i}) lc = vec3(${l.map(glslFloat).join(", ")});`).join("\n");

const SHARED = `const mat3 TDCF_PASS_709_TO_2020 = ${glslMat3(REC709_TO_REC2020)};
float tdcfPassRadius() {
  float full = floor(max(4.0, 8.0 * length(uSourceSize) / 8848.0));
  return full * max(1.0 / uTexel.x, 1.0 / uTexel.y) / max(uSourceSize.x, uSourceSize.y);
}
float tdcfTap(int i, float r) {
  return clamp(r + 1.0 - abs(float(i)), 0.0, 1.0);
}
ivec2 tdcfPassSize() {
  return ivec2(round(1.0 / uTexel));
}
float tdcfLumaAt(ivec2 texel) {
  vec3 rgb = TDCF_PASS_709_TO_2020 * fetchInput(texel);
  rgb = vec3(
    abs(rgb.r) <= 3.0e38 ? max(rgb.r, 0.0) : 0.0,
    abs(rgb.g) <= 3.0e38 ? max(rgb.g, 0.0) : 0.0,
    abs(rgb.b) <= 3.0e38 ? max(rgb.b, 0.0) : 0.0);
  int cs = output_cs;
  vec3 lc = vec3(0.2627, 0.678, 0.0593);
${lumaRows}
  return dot(lc, rgb) * exp2(input_exposure);
}
vec2 tdcfPrevAt(ivec2 texel) {
  return readPrev((vec2(texel) + 0.5) * uTexel).xy;
}`;

/** The params the passes read, bound from the transform's own keys. */
const UNIFORMS: UniformDeclaration[] = [
  { key: "input_exposure", glslType: "float", default: 0 },
  { key: "output_cs", glslType: "int", default: 1 },
  { key: "hl_detail_recovery", glslType: "float", default: 0.2 },
];

const MOMENTS = `ivec2 px = ivec2(gl_FragCoord.xy);
  int width = tdcfPassSize().x;
  float r = tdcfPassRadius();
  int n = int(r) + 1;
  float centre = tdcfLumaAt(px);
  float s1 = 0.0;
  float s2 = 0.0;
  float total = 0.0;
  for (int i = -n; i <= n; i++) {
    int x = px.x + i;
    float t = tdcfTap(i, r);
    if (t <= 0.0 || x < 0 || x >= width) continue;
    float d = tdcfLumaAt(ivec2(x, px.y)) - centre;
    s1 += t * d;
    s2 += t * d * d;
    total += t;
  }
  c = vec3(s1 / total, s2 / total, 0.0);`;

const SOLVE = `ivec2 px = ivec2(gl_FragCoord.xy);
  int height = tdcfPassSize().y;
  float r = tdcfPassRadius();
  int n = int(r) + 1;
  float centre = tdcfLumaAt(px);
  float m1 = 0.0;
  float m2 = 0.0;
  float total = 0.0;
  for (int i = -n; i <= n; i++) {
    int y = px.y + i;
    float t = tdcfTap(i, r);
    if (t <= 0.0 || y < 0 || y >= height) continue;
    vec2 row = tdcfPrevAt(ivec2(px.x, y));
    float d = tdcfLumaAt(ivec2(px.x, y)) - centre;
    m1 += t * (row.x + d);
    m2 += t * (row.y + 2.0 * d * row.x + d * d);
    total += t;
  }
  m1 /= total;
  m2 /= total;
  float variance = max(m2 - m1 * m1, 0.0);
  float mean = centre + m1;
  float a = variance / (variance + ${glslFloat(GUIDED_EPS)});
  c = vec3(a, mean - a * mean, 0.0);`;

const box = (horizontal: boolean) => `ivec2 px = ivec2(gl_FragCoord.xy);
  int size = tdcfPassSize().${horizontal ? "x" : "y"};
  float r = tdcfPassRadius();
  int n = int(r) + 1;
  vec2 sum = vec2(0.0);
  float total = 0.0;
  for (int i = -n; i <= n; i++) {
    int at = px.${horizontal ? "x" : "y"} + i;
    float t = tdcfTap(i, r);
    if (t <= 0.0 || at < 0 || at >= size) continue;
    sum += t * tdcfPrevAt(${horizontal ? "ivec2(at, px.y)" : "ivec2(px.x, at)"});
    total += t;
  }
  c = vec3(sum / total, 0.0);`;

export const DETAIL_PASSES: StagePass[] = [
  { glsl: MOMENTS, helpers: SHARED, uniforms: UNIFORMS },
  { glsl: SOLVE, helpers: SHARED, uniforms: UNIFORMS },
  { glsl: box(true), helpers: SHARED, uniforms: UNIFORMS },
  { glsl: box(false), helpers: SHARED, uniforms: UNIFORMS },
];
