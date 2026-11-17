// Builds test/reference/fixtures.json from libre-dt-lab's own C code.
//
// Copies sections of src/iop/3dcf.c verbatim into .build/tdcf_core.c, behind a
// small shim for the darktable headers they lean on, compiles harness.c with
// gcc, runs it over the cases below and writes what it printed. The unit tests
// read the fixtures, so they need neither gcc nor the upstream source.
//
// TDCF_SOURCE points at 3dcf.c (default: the SafeLight checkout's reference
// clone); CC names the compiler (default gcc).

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, ".build");
const source =
  process.env.TDCF_SOURCE ??
  join(here, "..", "..", "..", "..", "SafeLight", ".claude", "cycle", "ext-reference", "libre-dt-lab", "src-repo", "src", "iop", "3dcf.c");
const UPSTREAM_COMMIT = "ccb00d1b96744d3dad2477d2597cdf94aba2acd5";

const c = readFileSync(source, "utf8").replace(/\r\n/g, "\n");

/** The text from the line holding `start` up to (not including) the line holding `end`. */
function section(start, end) {
  const a = c.indexOf(start);
  if (a < 0) throw new Error(`3dcf.c has no "${start}"`);
  const from = c.lastIndexOf("\n", a) + 1;
  const b = c.indexOf(end, a);
  if (b < 0) throw new Error(`3dcf.c has no "${end}" after "${start}"`);
  return c.slice(from, c.lastIndexOf("\n", b) + 1);
}

const SHIM = `#define _USE_MATH_DEFINES
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef int gboolean;
#define TRUE 1
#define FALSE 0
#define CLAMPF(a, mn, mx) ((a) >= (mn) ? ((a) <= (mx) ? (a) : (mx)) : (mn))
/* src/common/matrices.c mat3inv_float */
#define A(y, x) src[(y - 1) * 3 + (x - 1)]
#define B(y, x) dst[(y - 1) * 3 + (x - 1)]
static int mat3inv(float *const dst, const float *const src)
{
  const float det = A(1, 1) * (A(3, 3) * A(2, 2) - A(3, 2) * A(2, 3))
                    - A(2, 1) * (A(3, 3) * A(1, 2) - A(3, 2) * A(1, 3))
                    + A(3, 1) * (A(2, 3) * A(1, 2) - A(2, 2) * A(1, 3));
  const float epsilon = 1e-7f;
  if(fabs(det) < epsilon) return 1;
  const float invDet = 1.0 / det;
  B(1, 1) = invDet * (A(3, 3) * A(2, 2) - A(3, 2) * A(2, 3));
  B(1, 2) = -invDet * (A(3, 3) * A(1, 2) - A(3, 2) * A(1, 3));
  B(1, 3) = invDet * (A(2, 3) * A(1, 2) - A(2, 2) * A(1, 3));
  B(2, 1) = -invDet * (A(3, 3) * A(2, 1) - A(3, 1) * A(2, 3));
  B(2, 2) = invDet * (A(3, 3) * A(1, 1) - A(3, 1) * A(1, 3));
  B(2, 3) = -invDet * (A(2, 3) * A(1, 1) - A(2, 1) * A(1, 3));
  B(3, 1) = invDet * (A(3, 2) * A(2, 1) - A(3, 1) * A(2, 2));
  B(3, 2) = -invDet * (A(3, 2) * A(1, 1) - A(3, 1) * A(1, 2));
  B(3, 3) = invDet * (A(2, 2) * A(1, 1) - A(2, 1) * A(1, 2));
  return 0;
}
#undef A
#undef B
`;

const core = [
  SHIM,
  section("typedef enum dt_iop_st_colorspace_t", "typedef struct dt_iop_3dcf_global_data_t"),
  section("/* Conversion matrices */", "#define ST_AUTO_HIST_BINS"),
  section("#define ST_AUTO_HIST_BINS", "   GUI <-> process() wiring"),
  section("/* Desaturation weight for highlights.", "/* Begin framework functions */"),
].join("\n");

mkdirSync(build, { recursive: true });
writeFileSync(join(build, "tdcf_core.c"), core);
writeFileSync(join(build, "harness.c"), readFileSync(join(here, "harness.c"), "utf8"));
const exe = join(build, process.platform === "win32" ? "harness.exe" : "harness");
// -ffp-contract=off: no fused multiply-adds, so each float operation rounds as written.
execFileSync(process.env.CC ?? "gcc", ["-O2", "-ffp-contract=off", "-std=c11", "-o", exe, join(build, "harness.c"), "-lm"], {
  cwd: build,
  stdio: "inherit",
});

// dt_iop_3dcf_params_t field order (3dcf.c L133-168) and $DEFAULTs, with the
// detail recovery off: it is spatial, and the extension leaves it out.
const FIELDS = [
  ["contrast", 2.25], ["gamma", 0], ["vibrance", 1], ["chromatic_boost", 0], ["peak_luminance", 0],
  ["input_exposure", 0], ["hl_hue_shift", 0], ["hl_desaturation", 0.25], ["hl_desat_threshold", 0.5],
  ["gamut_knee", 0.2], ["gamut_steepness", 0.5], ["output_cs", 1], ["color_look", 0], ["look_opacity", 1],
  ["contrast_pivot", 0.5], ["toe_power", 1], ["shoulder_power", 1], ["hl_detail_recovery", 0],
  ["chroma_x_contrast", 0], ["chroma_x_pivot", 50], ["chroma_z_contrast", 0], ["chroma_z_pivot", 50], ["mono_green", 0],
];
const DEFAULTS = Object.fromEntries(FIELDS);
const paramLine = (p) => "P " + FIELDS.map(([k]) => String(p[k])).join(" ");

const BASE_CASES = [
  ["defaults", {}],
  ["contrast low", { contrast: 0.25 }],
  ["contrast high", { contrast: 4.25 }],
  ["contrast 1, flat", { contrast: 1 }],
  ["pivot shadows", { contrast_pivot: 0.15 }],
  ["pivot highlights", { contrast_pivot: 0.9 }],
  ["toe and shoulder soft", { toe_power: 0.25, shoulder_power: 0.4 }],
  ["toe and shoulder hard", { toe_power: 3, shoulder_power: 2.5 }],
  ["mid-tones bright", { gamma: 1 }],
  ["mid-tones dark", { gamma: -0.6 }],
  ["exposure +2", { input_exposure: 2 }],
  ["exposure -2", { input_exposure: -2 }],
  ["peak -100", { peak_luminance: -100 }],
  ["peak -60", { peak_luminance: -60 }],
  ["peak +100", { peak_luminance: 100 }],
  ["vibrance 0", { vibrance: 0 }],
  ["vibrance 0.5", { vibrance: 0.5 }],
  ["vibrance 2", { vibrance: 2 }],
  ["chromatic boost", { chromatic_boost: 1 }],
  ["Abney warm", { hl_hue_shift: -1 }],
  ["Abney cool", { hl_hue_shift: 0.7 }],
  ["no highlight roll-off", { hl_desaturation: 0 }],
  ["full roll-off, early", { hl_desaturation: 1, hl_desat_threshold: 0 }],
  ["roll-off late", { hl_desaturation: 0.6, hl_desat_threshold: 1 }],
  ["knee 0", { gamut_knee: 0 }],
  ["knee 1, steep 0", { gamut_knee: 1, gamut_steepness: 0 }],
  ["steepness 1", { gamut_steepness: 1 }],
  ["sRGB target", { output_cs: 0 }],
  ["Display P3 target", { output_cs: 2 }],
  ["ProPhoto target", { output_cs: 3 }],
  ["Adobe RGB target", { output_cs: 4 }],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((look) => [`look ${look}`, { color_look: look }]),
  ["look 6 at 40%", { color_look: 6, look_opacity: 0.4 }],
  ["chroma contrast X", { chroma_x_contrast: 4 }],
  ["chroma contrast Z", { chroma_z_contrast: 6.5 }],
  ["chroma contrast both, pivots", { chroma_x_contrast: 10, chroma_z_contrast: 3, chroma_x_pivot: 30, chroma_z_pivot: 70 }],
  ["monochrome", { color_look: 11 }],
  ["monochrome, filters", { color_look: 11, chroma_x_contrast: 8, chroma_z_contrast: 2, chroma_x_pivot: 40 }],
  ["monochrome, green filter", { color_look: 11, chroma_x_contrast: 3, chroma_z_contrast: 3, mono_green: 7 }],
  [
    "everything",
    {
      contrast: 3.1, contrast_pivot: 0.42, toe_power: 1.6, shoulder_power: 0.7, gamma: 0.35, input_exposure: 0.6,
      peak_luminance: 35, vibrance: 1.4, chromatic_boost: 0.5, hl_hue_shift: 0.4, hl_desaturation: 0.5,
      hl_desat_threshold: 0.3, gamut_knee: 0.12, gamut_steepness: 0.3, output_cs: 2, color_look: 9, look_opacity: 0.7,
      chroma_x_contrast: 2.5, chroma_z_contrast: 1.5, chroma_x_pivot: 55, chroma_z_pivot: 45,
    },
  ],
];

// At chroma contrast 0 upstream holds the sigmoid gain at 1e-4, and its float
// normalisation cancels: the output there carries noise of up to ~12 % in a
// channel of a bright, saturated pixel (src/context.ts sigmoidResponse). The C
// is accurate from a gain of about 0.1 up (its noise falls as 1/gain), so each case runs with both axes
// at 0.1 (in place of 0) and again at 2, and the twin is held to both tightly.
const withChroma = (p, k) => ({ ...p, chroma_x_contrast: Math.max(p.chroma_x_contrast ?? 0, k), chroma_z_contrast: Math.max(p.chroma_z_contrast ?? 0, k) });
const CASES = BASE_CASES.flatMap(([name, over]) =>
  (over.chroma_x_contrast ?? 0) >= 1 && (over.chroma_z_contrast ?? 0) >= 1
    ? [[name, over]]
    : [[`${name}, chroma 0.1`, withChroma(over, 0.1)], [`${name}, chroma 2`, withChroma(over, 2)]],
);

// Rec.2020 (D50-adapted) scene-linear inputs: a grey wedge, hues around the
// circle at several purities and levels, wide-gamut and negative values, zero.
function pixels() {
  const out = [];
  for (let ev = -12; ev <= 9; ev += 1.5) {
    const v = 0.18 * 2 ** ev;
    out.push([v, v, v]);
  }
  for (const level of [0.02, 0.18, 0.9, 4]) {
    for (const purity of [0.2, 0.6, 0.95]) {
      for (let h = 0; h < 360; h += 30) {
        const a = (h * Math.PI) / 180;
        const w = [Math.cos(a), Math.cos(a - (2 * Math.PI) / 3), Math.cos(a + (2 * Math.PI) / 3)];
        out.push(w.map((x) => level * (1 + purity * x)));
      }
    }
  }
  out.push([2.5, 0.05, 0.01], [0.01, 1.8, 0.02], [0.02, 0.05, 6], [0.4, -0.05, 0.3], [-0.1, 0.5, 0.2], [0, 0, 0], [1e-9, 1e-9, 1e-9], [40, 38, 35], [120, 10, 5]);
  return out;
}

// A small scene for auto-adjust: a lit wedge with a few saturated patches.
function scene(w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ev = -8 + (14 * x) / (w - 1);
      const v = 0.18 * 2 ** ev * (0.6 + 0.4 * (y / (h - 1)));
      out.push(y % 5 === 0 ? [v * 1.6, v * 0.4, v * 0.2] : [v, v, v]);
    }
  }
  return out;
}

const PX = pixels();
const fmt = (v) => (Number.isFinite(v) ? v.toPrecision(9) : "0");
const lines = [];
for (const [, over] of CASES) {
  const p = { ...DEFAULTS, ...over };
  lines.push(paramLine(p), "X");
  for (const px of PX) lines.push(`R ${px.map(fmt).join(" ")}`);
  for (let ev = -10; ev <= 8; ev += 0.5) lines.push(`Y ${fmt(0.18 * 2 ** ev)}`);
}
const AUTO = [];
const W = 48;
const H = 20;
const sc = scene(W, H);
for (const mode of [0, 1, 2]) {
  for (const picked of [0, 0.05]) {
    AUTO.push({ mode, picked });
    lines.push(paramLine(DEFAULTS), `A ${mode} ${picked} ${W} ${H} ${sc.map((px) => px.map(fmt).join(" ")).join(" ")}`);
  }
}

// The detail recovery over a small scene: lit steps with fine texture and a
// few saturated patches, through process() with upstream's colour-guided
// filter and with the grey-guided one the GPU port runs.
function detailScene(w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const step = 0.18 * 2 ** (-3 + Math.floor((7 * x) / w));
      const texture = 1 + 0.25 * Math.sin(x * 1.7) * Math.cos(y * 2.3) + (((x * 7 + y * 13) % 5) - 2) * 0.04;
      const v = step * texture * (y < h / 3 ? 4 : 1);
      out.push((x + y) % 9 === 0 ? [v * 1.8, v * 0.5, v * 0.2] : y > (2 * h) / 3 ? [v * 0.4, v * 0.7, v * 1.6] : [v, v, v]);
    }
  }
  return out;
}
const DW = 36;
const DH = 27;
const dScene = detailScene(DW, DH);
const DETAIL = [];
for (const detail of [0.2, 1]) {
  for (const grey of [0, 1]) {
    DETAIL.push({ detail, grey });
    lines.push(paramLine(withChroma({ ...DEFAULTS, hl_detail_recovery: detail }, 0.1)), `D ${DW} ${DH} ${grey} ${dScene.map((px) => px.map(fmt).join(" ")).join(" ")}`);
  }
}

const out = execFileSync(exe, { input: lines.join("\n") + "\n", maxBuffer: 1 << 28 }).toString().trim().split(/\r?\n/);
let k = 0;
const cases = CASES.map(([name, over]) => {
  const context = JSON.parse(out[k++]);
  const pixelsOut = PX.map(() => JSON.parse(out[k++]));
  const curve = [];
  for (let ev = -10; ev <= 8; ev += 0.5) curve.push([0.18 * 2 ** ev, ...JSON.parse(out[k++])]);
  return { name, params: over, context, inputs: PX, outputs: pixelsOut, curve };
});
const auto = AUTO.map((a) => ({ ...a, result: JSON.parse(out[k++]) }));
const detailRuns = DETAIL.map((d) => ({ ...d, output: JSON.parse(out[k++]) }));
if (k !== out.length) throw new Error(`harness printed ${out.length} lines, read ${k}`);

writeFileSync(
  join(here, "fixtures.json"),
  JSON.stringify({ upstream: `libre-dt-lab ${UPSTREAM_COMMIT} src/iop/3dcf.c`, defaults: DEFAULTS, cases, auto: { width: W, height: H, scene: sc, runs: auto }, detail: { width: DW, height: DH, scene: dScene, runs: detailRuns } }),
);
console.log(`fixtures.json: ${cases.length} cases x ${PX.length} pixels, ${auto.length} auto-adjust runs`);
