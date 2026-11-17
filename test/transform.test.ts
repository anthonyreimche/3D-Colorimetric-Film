// The contribution as the core takes it: every param declared with its
// range, every uniform derived and finite at the ends of every range, and
// activate registering the transform and the panel.

import { describe, expect, it } from "vitest";
import { activate } from "../src/index";
import { DEFAULTS, PARAMS, type Params } from "../src/params";
import { UNIFORM_TYPES, deriveUniforms } from "../src/derive";
import { TRANSFORM_ID, colorimetricFilmTransform } from "../src/transform";
import { fakeApi } from "./support/fake-api";

const SIZES = { vec3: 3, vec4: 4, mat3: 9 } as const;

describe("the transform", () => {
  const t = colorimetricFilmTransform();

  it("declares every param with its range and skips the core's own tone", () => {
    expect(t.params?.map((u) => u.key)).toEqual(Object.keys(PARAMS));
    expect(t.skipBaseCurve).toBe(true);
    expect(t.skipToneShoulder).toBe(true);
    expect(t.derive?.uniforms.map((u) => u.key)).toEqual(Object.keys(UNIFORM_TYPES));
  });

  it("derives finite uniforms of the declared sizes at both ends of every param", () => {
    for (const [key, def] of Object.entries(PARAMS)) {
      for (const v of [def.min, def.max]) {
        const u = deriveUniforms({ ...DEFAULTS, [key]: v } as Params);
        for (const [name, type] of Object.entries(UNIFORM_TYPES)) {
          const value = u[name as keyof typeof u];
          expect(value, `${key}=${v} ${name}`).toHaveLength(SIZES[type]);
          expect(value.every(Number.isFinite), `${key}=${v} ${name}`).toBe(true);
        }
      }
    }
  });

  it("reads a stored bag through the declared ranges", () => {
    const u = t.derive?.fn({ contrast: 99, color_look: 3.6, chroma_x_contrast: Number.NaN });
    expect(u).toEqual(deriveUniforms({ ...DEFAULTS, contrast: 4.25, color_look: 4 }));
  });

  it("activates with the transform and its panel", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.pipelines.map((p) => p.id)).toEqual([TRANSFORM_ID]);
    expect(rig.panels.map((p) => p.id)).toEqual(["colorimetric-film.panel"]);
  });
});

describe("the detail pre-pass", () => {
  const t = colorimetricFilmTransform();

  it("runs while the detail recovery isn't 0, binding the params its passes read", () => {
    expect(t.prepass?.dormantWhen).toEqual({ hl_detail_recovery: 0 });
    const keys = new Set((t.prepass?.passes ?? []).flatMap((p) => (p.uniforms ?? []).map((u) => u.key)));
    for (const key of keys) expect(Object.keys(PARAMS)).toContain(key);
    expect([...keys].sort()).toEqual(["hl_detail_recovery", "input_exposure", "output_cs"]);
  });

  it("draws four separable box passes", () => {
    expect(t.prepass?.passes).toHaveLength(4);
  });
});
