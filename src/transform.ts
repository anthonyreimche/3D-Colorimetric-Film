// 3D Colorimetric Film, a Safelight extension. GPL-3.0-or-later. See LICENSE.

import { DEFAULTS, PARAMS } from "./params";
import { declarations, readParams, uniformDeclarations } from "./param-table";
import type { PipelineContribution } from "./safelight";
import { UNIFORM_TYPES, deriveUniforms, type Uniforms } from "./derive";
import { GLSL, HELPERS } from "./glsl";
import { DETAIL_PASSES } from "./glsl-detail";

export const TRANSFORM_ID = "colorimetric-film.3dcf";
export const TRANSFORM_NAME = "3D Colorimetric Film";

/** The uniforms of the defaults: what a photo renders with if derive's results are ever missing. */
export const DEFAULT_UNIFORMS: Uniforms = deriveUniforms(DEFAULTS);

export function colorimetricFilmTransform(): PipelineContribution {
  return {
    id: TRANSFORM_ID,
    name: TRANSFORM_NAME,
    description:
      "Tone and colour worked out in CIE XYZ: a single-stage tone scale on luminance with contrast around a pivot, chromaticity carried along and rolled off toward the spectral locus like film dyes, and bright colours bleaching to white.",
    glsl: GLSL,
    helpers: HELPERS,
    skipBaseCurve: true,
    skipToneShoulder: true,
    params: declarations(PARAMS),
    derive: {
      uniforms: uniformDeclarations(UNIFORM_TYPES, DEFAULT_UNIFORMS),
      fn: (values) => deriveUniforms(readParams(PARAMS, values)),
    },
    // The detail recovery's guided filter, which needs each pixel's neighbourhood.
    prepass: { passes: DETAIL_PASSES, dormantWhen: { hl_detail_recovery: 0 } },
  };
}
