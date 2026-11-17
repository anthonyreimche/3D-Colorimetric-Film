// The X/Z lock against upstream's GUI callbacks: the balance read from the
// two strengths, Z following X at the balance, and the balance split.

import { describe, expect, it } from "vitest";
import { DEFAULTS, type Params } from "../src/params";
import { CHROMA_RESET, balanceEdit, balanceFromXZ, lockedEdit, zFromX } from "../src/panel/model";

const p = (over: Partial<Params>): Params => ({ ...DEFAULTS, ...over });

describe("balance", () => {
  it.each([
    [4, 4, 0],
    [4, 2, 0.5],
    [2, 4, -0.5],
    [4, 0, 1],
    [0, 4, -1],
    [0, 0, 0],
  ])("X %d, Z %d reads %d", (x, z, b) => expect(balanceFromXZ(x, z)).toBeCloseTo(b, 12));

  it("round-trips through Z from X while Z stays in range", () => {
    for (const b of [-0.5, -0.2, 0, 0.3, 1]) expect(balanceFromXZ(3, zFromX(3, b))).toBeCloseTo(b, 12);
  });

  it("holds Z to its range and stays finite at a balance of -1", () => {
    expect(zFromX(8, -0.5)).toBe(10);
    expect(zFromX(3, -1)).toBe(10);
    expect(zFromX(0, -1)).toBe(0);
  });
});

describe("locked edits", () => {
  it("drives Z from X at the balance and the Z pivot from the X pivot", () => {
    expect(lockedEdit(p({ chroma_x_contrast: 4, chroma_z_contrast: 2 }), { chroma_x_contrast: 6 }, 0.5)).toEqual({
      chroma_x_contrast: 6,
      chroma_z_contrast: 3,
      chroma_z_pivot: 50,
    });
    expect(lockedEdit(p({}), { chroma_x_pivot: 40 }, 0)).toEqual({ chroma_x_pivot: 40, chroma_z_contrast: 0, chroma_z_pivot: 40 });
  });

  it("leaves other edits alone", () => {
    expect(lockedEdit(p({}), { contrast: 3 }, 0.5)).toEqual({ contrast: 3 });
  });

  it("splits the larger strength by the balance", () => {
    expect(balanceEdit(p({ chroma_x_contrast: 4, chroma_z_contrast: 2, chroma_x_pivot: 60 }), -0.25)).toEqual({
      chroma_x_contrast: 3,
      chroma_z_contrast: 4,
      chroma_z_pivot: 60,
    });
  });

  it("resets both axes to the defaults", () => {
    expect(CHROMA_RESET).toEqual({ chroma_x_contrast: 0, chroma_z_contrast: 0, chroma_x_pivot: 50, chroma_z_pivot: 50 });
  });
});
