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
// The display transform's GLSL. Transcribes the same functions of libre-dt-lab
// src/iop/3dcf.c (ccb00d1b9) as twin.ts, which is its TypeScript twin, line
// for line. Safelight hands the transform linear Rec.709; upstream's working
// space is Rec.2020, so the pixel goes there and back around the module, as
// darktable's input and output colour profiles take it.
//
// The uniform names are DERIVED_TYPES's keys. The host prefixes them and the
// helper functions; the constants keep their names, so they carry TDCF_.

import { columnMajor, type Mat3 } from "./colour/mat3";
import { REC2020_TO_REC709, REC709_TO_REC2020 } from "./colour/profiles";
import { INPUT_MATRIX, OUTPUT_MATRIX, SPECTRAL_BOUNDARY, WHITE_X, WHITE_Z } from "./context";
import { GAMUT_REACH } from "./tables";

export function glslFloat(x: number): string {
  const s = x.toPrecision(10);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

export const glslMat3 = (m: Mat3): string => `mat3(${columnMajor(m).map(glslFloat).join(", ")})`;

const glslArray = (name: string, values: readonly number[]): string =>
  `const float ${name}[${values.length}] = float[${values.length}](${values.map(glslFloat).join(", ")});`;

const WSUM = WHITE_X + 1 + WHITE_Z;

const CONSTANTS = `const mat3 TDCF_709_TO_2020 = ${glslMat3(REC709_TO_REC2020)};
const mat3 TDCF_2020_TO_709 = ${glslMat3(REC2020_TO_REC709)};
const mat3 TDCF_IN = ${glslMat3(INPUT_MATRIX)};
const mat3 TDCF_OUT = ${glslMat3(OUTPUT_MATRIX)};
const float TDCF_WHITE_X = ${glslFloat(WHITE_X)};
const float TDCF_WHITE_Z = ${glslFloat(WHITE_Z)};
const float TDCF_WCX = ${glslFloat(WHITE_X / WSUM)};
const float TDCF_WCZ = ${glslFloat(WHITE_Z / WSUM)};
const float TDCF_SHAPE_REF = 2.090563;
${glslArray("TDCF_BOUNDARY", SPECTRAL_BOUNDARY)}
${glslArray("TDCF_REACH", GAMUT_REACH)}`;

// tdcfFinite: comparisons with NaN are false, and the bound excludes the infinities.
// tdcfEncode: Safelight decodes a transform's output as the sRGB curve; the
// sign is kept and there's no ceiling. mix with a bvec3 selects, so pow's
// result for a branch not taken can't leak in.
export const HELPERS = `${CONSTANTS}
bool tdcfFinite(float x) {
  return abs(x) <= 3.0e38;
}
vec3 tdcfEncode(vec3 x) {
  vec3 a = abs(x);
  vec3 e = mix(a * 12.92, 1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, greaterThanEqual(a, vec3(0.0031308)));
  return sign(x) * e;
}
float tdcfSsts(float x) {
  if (!(x > 0.0)) return 0.0;
  float f = tdcfSstsP.y * pow(x / (x + tdcfSstsP.x), tdcfSstsP.z);
  return (f * f) / (f + tdcfSstsP.w) * 100.0;
}
float tdcfYTm(float yScene) {
  float y = tdcfSsts(yScene * tdcfTone.x) / 100.0;
  y = pow(max(y, 0.0), 1.0 / 2.4);
  y = min(y, 1.0);
  if (tdcfCurve.z > 0.5) {
    float c = tdcfTone.y;
    float p = tdcfTone.z;
    if (y <= p) {
      float t = p > 0.0 ? y / p : 0.0;
      float e = c * (tdcfCurve.x + (1.0 - tdcfCurve.x) * t);
      y = p * pow(max(y / p, 0.0), e);
    } else {
      float rp = 1.0 - p;
      float t = rp > 0.0 ? (1.0 - y) / rp : 0.0;
      float e = c * (tdcfCurve.y + (1.0 - tdcfCurve.y) * t);
      y = 1.0 - rp * pow(max((1.0 - y) / rp, 0.0), e);
    }
  }
  return y;
}
float tdcfDesat(float yNorm, float hlDesat, float threshold) {
  if (hlDesat <= 0.0 || yNorm <= threshold) return 0.0;
  if (!tdcfFinite(yNorm)) return 0.0;
  float t = max(yNorm - threshold, 0.0) / yNorm;
  float x = min(t * hlDesat, 1.0);
  return x * x;
}
float tdcfDegrees(float dz, float dx) {
  if (dz == 0.0 && dx == 0.0) return 0.0;
  float a = degrees(atan(dz, dx));
  if (a < 0.0) a += 360.0;
  if (a >= 360.0) a -= 360.0;
  return a;
}
float tdcfBoundary(float angle) {
  int bin = min(int(angle), 359);
  int next = bin == 359 ? 0 : bin + 1;
  return TDCF_BOUNDARY[bin] + (angle - float(bin)) * (TDCF_BOUNDARY[next] - TDCF_BOUNDARY[bin]);
}
float tdcfReach(float h) {
  int i0 = min(int(h), 359);
  int i1 = i0 == 359 ? 0 : i0 + 1;
  return TDCF_REACH[i0] + (h - float(i0)) * (TDCF_REACH[i1] - TDCF_REACH[i0]);
}
float tdcfChromaNorm(float h) {
  float hr = radians(h);
  float a = cos(hr);
  float b = sin(hr);
  float a2 = a * a - b * b;
  float b2 = 2.0 * a * b;
  float a3 = 4.0 * a * a * a - 3.0 * a;
  float b3 = 3.0 * b - 4.0 * b * b * b;
  return 11.34072 * a + 16.46899 * a2 + 7.8838 * a3 + 14.66441 * b - 6.37224 * b2 + 9.19364 * b3 + 77.12896;
}
float tdcfExpm1(float x) {
  return abs(x) < 0.1 ? x * (1.0 + x / 2.0 * (1.0 + x / 3.0 * (1.0 + x / 4.0 * (1.0 + x / 5.0)))) : exp(x) - 1.0;
}
float tdcfResponse(float u, float gain, float shift) {
  return (tdcfExpm1(-gain * u) / tdcfExpm1(-gain)) * ((1.0 + exp(-gain * (1.0 - shift))) / (1.0 + exp(-gain * (u - shift))));
}
float tdcfNeutral(float r, float u01, float r05) {
  return u01 <= 0.5 ? 0.5 * r / max(r05, 1.0e-4) : 0.5 + 0.5 * (r - r05) / max(1.0 - r05, 1.0e-4);
}
vec2 tdcfChromaContrast(vec2 xz, float yTm) {
  if (yTm <= 0.0) return xz;
  if (!tdcfFinite(xz.x) || !tdcfFinite(xz.y)) return xz;
  float sum = xz.x + yTm + xz.y;
  if (sum <= 0.0) return xz;
  float dx = xz.x / sum - TDCF_WCX;
  float dz = xz.y / sum - TDCF_WCZ;
  float maxDist = tdcfBoundary(tdcfDegrees(dz, dx));
  if (maxDist <= 0.0) return xz;
  float u01 = 0.5 * (clamp(dx / maxDist, -1.0, 1.0) + 1.0);
  float w01 = 0.5 * (clamp(dz / maxDist, -1.0, 1.0) + 1.0);
  float rnu = tdcfNeutral(tdcfResponse(u01, tdcfChroma.x, tdcfChroma.y), u01, tdcfChromaN.x);
  float rnw = tdcfNeutral(tdcfResponse(w01, tdcfChroma.z, tdcfChroma.w), w01, tdcfChromaN.y);
  float cx = TDCF_WCX + (2.0 * rnu - 1.0) * maxDist;
  float cz = TDCF_WCZ + (2.0 * rnw - 1.0) * maxDist;
  float yNew = 1.0 - cx - cz;
  return yNew > 0.0 ? vec2(cx, cz) * (yTm / yNew) : xz;
}
vec2 tdcfSpectralGamut(vec2 xz, float yTm) {
  if (yTm <= 0.0) return xz;
  if (!tdcfFinite(xz.x) || !tdcfFinite(xz.y)) return xz;
  float sum = xz.x + yTm + xz.y;
  if (sum <= 0.0) return xz;
  float dx = xz.x / sum - TDCF_WCX;
  float dz = xz.y / sum - TDCF_WCZ;
  float chromaSq = dx * dx + dz * dz;
  float maxDist = tdcfBoundary(tdcfDegrees(dz, dx));
  float target = maxDist * 0.92;
  if (maxDist > 0.0 && chromaSq > target * target) {
    float chroma = sqrt(chromaSq);
    float excess = chroma - target;
    float bsteep = max(target * 0.05, 0.001);
    float scale = (chroma - excess / (excess + bsteep) * excess) / chroma;
    float cx = TDCF_WCX + scale * dx;
    float cz = TDCF_WCZ + scale * dz;
    float yNew = 1.0 - cx - cz;
    if (yNew > 0.0) {
      xz = vec2(cx, cz) * (yTm / yNew);
      dx = cx - TDCF_WCX;
      dz = cz - TDCF_WCZ;
      chromaSq = dx * dx + dz * dz;
    }
  }
  float angle = tdcfDegrees(dz, dx);
  float shape = tdcfReach(angle) / max(tdcfChromaNorm(angle), 1.0e-6);
  float kneeMod = tdcfGamut.x * sqrt(max(shape / TDCF_SHAPE_REF, 0.0));
  if (chromaSq > kneeMod * kneeMod) {
    float chroma = sqrt(chromaSq);
    float excess = chroma - kneeMod;
    float scale = (chroma - excess / (excess + tdcfGamut.y) * excess) / chroma;
    float xNew = TDCF_WCX + scale * dx;
    float zNew = TDCF_WCZ + scale * dz;
    float yNew = 1.0 - xNew - zNew;
    if (yNew > 0.0) xz = vec2(xNew, zNew) * (yTm / yNew);
  }
  return xz;
}
vec3 tdcfGamutCompress(vec3 rgb) {
  float luma = dot(tdcfLuma, rgb);
  float anchor = luma > 1.0e-4 ? luma : 1.0;
  float t = 0.0;
  for (int c = 0; c < 3; c++) {
    if (rgb[c] < 0.0) {
      float denom = anchor - rgb[c];
      t = max(t, denom > 1.0e-6 ? -rgb[c] / denom : 1.0);
    } else if (rgb[c] > 1.0) {
      float denom = rgb[c] - anchor;
      t = max(t, denom > 1.0e-6 ? (rgb[c] - 1.0) / denom : 1.0);
    }
  }
  if (t <= 0.0) return rgb;
  float blend = min(t, 1.0);
  return (1.0 - blend) * rgb + blend * anchor;
}
vec3 tdcfSaturate(vec3 rgb, float gain) {
  float luma = dot(tdcfLuma, rgb);
  return luma + gain * (rgb - luma);
}
float tdcfSatNorm(vec3 rgb) {
  float luma = dot(tdcfLuma, rgb);
  float maxc = max(rgb.r, max(rgb.g, rgb.b));
  float minc = min(rgb.r, min(rgb.g, rgb.b));
  float level = max(maxc, max(abs(minc), abs(luma)));
  return level > 0.0 ? (maxc - minc) / level : 0.0;
}
vec3 tdcfEval(vec3 rgbIn) {
  vec3 xyz = TDCF_IN * rgbIn;
  float yAbs = xyz.y;
  if (!(yAbs > 1.0e-10) || !tdcfFinite(yAbs)) return vec3(0.0);
  float xRatio = clamp(xyz.x / yAbs, -100.0, 100.0);
  float zRatio = clamp(xyz.z / yAbs, -100.0, 100.0);

  float yTm = tdcfYTm(yAbs);
  if (tdcfCurve.w > 0.5) yTm = pow(clamp(yTm, 0.0, 1.0), tdcfTone.w);

  vec2 xz = vec2(xRatio, zRatio) * yTm;
  xz = tdcfChromaContrast(xz, yTm);
  xz = tdcfSpectralGamut(xz, yTm);

  float yExposed = yAbs * tdcfTone.x;
  float w = tdcfDesat(yExposed, tdcfHl.x, tdcfHl.y);

  if (tdcfLookMix.z > 0.5) {
    float off = tdcfChromaN.z * (xz.x - TDCF_WHITE_X * yTm) + tdcfChromaN.w * (xz.y - TDCF_WHITE_Z * yTm);
    float lim = 0.6 * yTm;
    float aOff = abs(off);
    if (aOff > lim) {
      float soft = max(lim * 0.5, 1.0e-6);
      float over = aOff - lim;
      float v = lim + over / (over + soft) * soft;
      off = off < 0.0 ? -v : v;
    }
    float grey = max(yTm + off, 0.0);
    if (!tdcfFinite(grey)) grey = 0.0;
    if (w > 0.0 && tdcfFinite(w)) {
      float ts = min(w, 1.0);
      grey = grey * (1.0 - ts) + ts;
    }
    return vec3(grey);
  }

  vec3 rgb = TDCF_OUT * vec3(xz.x, yTm, xz.y);

  if (tdcfHl.z != 0.0 && yAbs > 1.0e-10) {
    float compression = min(yTm / (yAbs * tdcfTone.x), 1.0);
    float angle = tdcfHl.z * 0.8 * pow(1.0 - compression, 0.5);
    float ca = cos(angle);
    float sa = sin(angle);
    if (tdcfFinite(ca) && tdcfFinite(sa)) {
      vec3 lc = tdcfLuma;
      float y = dot(lc, rgb);
      float u = rgb.r - y;
      float v = rgb.b - y;
      float ur = u * ca - v * sa;
      float vr = u * sa + v * ca;
      float t = 1.0;
      if (ur > 0.0) t = min(t, (1.0 - y) / ur);
      if (ur < 0.0) t = min(t, -y / ur);
      if (vr > 0.0) t = min(t, (1.0 - y) / vr);
      if (vr < 0.0) t = min(t, -y / vr);
      if (lc.g != 0.0) {
        float gd = -(lc.r * ur + lc.b * vr) / lc.g;
        if (gd > 0.0) t = min(t, (1.0 - y) / gd);
        if (gd < 0.0) t = min(t, -y / gd);
      }
      t = max(t, 0.0);
      rgb.r = y + t * ur;
      rgb.b = y + t * vr;
      if (lc.g != 0.0) rgb.g = y - (lc.r / lc.g) * t * ur - (lc.b / lc.g) * t * vr;
    }
  }

  if (w > 0.0 && tdcfFinite(w)) {
    float maxc = max(rgb.r, max(rgb.g, rgb.b));
    float minc = min(rgb.r, min(rgb.g, rgb.b));
    float sat = maxc > 0.0 ? (maxc - minc) / maxc : 0.0;
    float ss = (sat * sat) / (sat * sat + (1.0 - sat) * (1.0 - sat) + 1.0e-6);
    float wFinal = w;
    if (tdcfHl.x > 0.0) wFinal = min(wFinal + tdcfDesat(yExposed, 1.0, tdcfHl.y) * (tdcfHl.x * ss * 0.35), 1.0);
    float ts = min(wFinal, 1.0);
    if (tdcfFinite(ts)) rgb = rgb * (1.0 - ts) + ts;
  }

  if (tdcfHl.w != 1.0) {
    float vib = max(tdcfHl.w, 0.0);
    float gain = vib;
    if (vib > 1.0) {
      float p = 1.0 - min(tdcfSatNorm(rgb), 1.0);
      gain = 1.0 + (vib - 1.0) * (p * p);
    }
    rgb = tdcfSaturate(rgb, gain);
  }

  if (tdcfGamut.z > 0.0) {
    float maxc = max(rgb.r, max(rgb.g, rgb.b));
    float minc = min(rgb.r, min(rgb.g, rgb.b));
    float satM = maxc - minc;
    float logRel = log2(max(yAbs / 0.18, 1.0e-10));
    float wGauss = exp(-(logRel * logRel) / (2.0 * 1.85 * 1.85));
    float wMid = logRel <= 0.0 ? 1.0 : 1.328 * wGauss - 0.328;
    float pp = 1.0 - min(tdcfSatNorm(rgb), 1.0);
    float hue = 0.0;
    if (satM > 0.0) {
      if (maxc == rgb.r) hue = 60.0 * ((rgb.g - rgb.b) / satM);
      else if (maxc == rgb.g) hue = 60.0 * ((rgb.b - rgb.r) / satM + 2.0);
      else hue = 60.0 * ((rgb.r - rgb.g) / satM + 4.0);
      if (hue < 0.0) hue += 360.0;
    }
    float hueMod = 1.0 + 0.1 * cos(radians(hue - 60.0));
    rgb = tdcfSaturate(rgb, 1.0 + tdcfGamut.z * wMid * (pp * pp) * hueMod);
  }

  rgb = tdcfGamutCompress(rgb);
  if (tdcfGamut.w > 0.5) rgb = tdcfGamutInv * max(tdcfGamutFwd * rgb, vec3(0.0));

  return vec3(
    tdcfFinite(rgb.r) ? max(rgb.r, 0.0) : 0.0,
    tdcfFinite(rgb.g) ? max(rgb.g, 0.0) : 0.0,
    tdcfFinite(rgb.b) ? max(rgb.b, 0.0) : 0.0);
}
vec3 tdcfRecover(vec3 o, float lumOrig, float desatFactor) {
  float lumTm = dot(tdcfLuma, o);
  if (!(lumTm > 1.0e-6 && lumOrig > 1.0e-6)) return o;
  float base = max(slTransformPass.x * lumOrig + slTransformPass.y, 0.0);
  float detail = lumOrig - base;
  float t = min(tdcfLookMix.w, 1.0);
  float dl = max(lumOrig * 0.1 * (1.0 - t * 0.5), 1.0e-6);
  float da = abs(detail);
  if (da > dl) {
    float excess = da - dl;
    float bsteep = max(dl * 0.25 * (1.0 - t * 0.4), 0.001);
    float v = dl + excess / (excess + bsteep) * bsteep;
    detail = detail < 0.0 ? -v : v;
  }
  float lumFinal = lumTm + detail * tdcfLookMix.w * (1.0 - desatFactor) * (lumTm / lumOrig);
  if (!(lumFinal > 1.0e-6)) return o;
  return o * max(lumFinal / lumTm, 0.25);
}
vec3 tdcfProcess(vec3 c) {
  vec3 rgb = vec3(
    tdcfFinite(c.r) ? max(c.r, 0.0) : 0.0,
    tdcfFinite(c.g) ? max(c.g, 0.0) : 0.0,
    tdcfFinite(c.b) ? max(c.b, 0.0) : 0.0);
  float lumOrig = dot(tdcfLuma, rgb) * tdcfTone.x;
  float lum = max(rgb.r, max(rgb.g, rgb.b));
  float w = tdcfDesat(lum * tdcfTone.x, tdcfHl.x, tdcfHl.y);
  float desatFactor = 0.0;
  if (w > 0.0 && tdcfFinite(w)) {
    float t = min(w, 1.0);
    float ts = (t * t) / (t * t + (1.0 - t) * (1.0 - t) + 1.0e-6);
    desatFactor = ts;
    if (tdcfFinite(ts) && ts > 0.0) rgb = rgb * (1.0 - ts) + lum * ts;
  }
  vec3 o = tdcfEval(rgb);
  if (tdcfLookMix.y > 0.5) o = max(o * (1.0 - tdcfLookMix.x) + (tdcfLook * o) * tdcfLookMix.x, vec3(0.0));
  // The pre-pass runs exactly while the recovery isn't 0 (its dormantWhen).
  if (tdcfLookMix.w > 0.0) o = tdcfRecover(o, lumOrig, desatFactor);
  return o;
}`;

export const GLSL = `vec3 pipelineToDisplay(vec3 lin) {
  return tdcfEncode(TDCF_2020_TO_709 * tdcfProcess(TDCF_709_TO_2020 * lin));
}`;
