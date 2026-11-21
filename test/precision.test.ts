// Radeon radeonsi runs mediump as fp16: integers above 2048 round, so a texel
// centre built from a mediump ivec2 lands on the wrong texel at large renders.
import { describe, expect, it } from "vitest";
import { DETAIL_PASSES } from "../src/glsl-detail";

describe("detail pass helpers precision", () => {
  it("reads texels through highp ivec2 parameters", () => {
    for (const pass of DETAIL_PASSES) {
      expect(pass.helpers).toContain("float tdcfLumaAt(highp ivec2 texel)");
      expect(pass.helpers).toContain("vec2 tdcfPrevAt(highp ivec2 texel)");
      expect(pass.helpers).not.toMatch(/\((?<!highp )ivec2 texel\)/);
    }
  });
});
