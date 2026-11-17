// @vitest-environment jsdom
// The panel: the switch when the photo uses another transform, sliders in
// upstream's display units writing live and committing on release, the X/Z
// lock, what the monochrome look hides and relabels, auto adjust and reset.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULTS, PARAMS } from "../src/params";
import { AUTO_NO_FRAME, AUTO_UNSUPPORTED, FilmPanel, INACTIVE_HINT, OLDER_PROCESSING, resetActive } from "../src/panel/Panel";
import { qualify, readParams, unqualify } from "../src/param-table";
import { initRuntime } from "../src/runtime";
import { TRANSFORM_ID, colorimetricFilmTransform } from "../src/transform";
import { fakeApi, frameOf, type Rig, type RigOptions } from "./support/fake-api";

let rig: Rig;

function mount(o: RigOptions = {}) {
  rig = fakeApi({ displayTransform: TRANSFORM_ID, ...o });
  rig.api.registerPipeline(colorimetricFilmTransform());
  initRuntime(rig.api);
  return render(React.createElement(FilmPanel));
}

const params = () => readParams(PARAMS, unqualify(TRANSFORM_ID, rig.develop.getState().paramBag));
const field = (label: string) => screen.getByRole("textbox", { name: `${label} value` }) as HTMLInputElement;
const type = (label: string, text: string) => {
  fireEvent.change(field(label), { target: { value: text } });
  fireEvent.blur(field(label));
};
const queryField = (label: string) => screen.queryByRole("textbox", { name: `${label} value` });

afterEach(cleanup);

describe("a photo on another transform", () => {
  it("offers the switch, one undo step", () => {
    mount({ displayTransform: "rendering.aces" });
    expect(screen.getByText(INACTIVE_HINT)).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use 3D Colorimetric Film" }));
    expect(rig.develop.getState().params.displayTransform).toBe(TRANSFORM_ID);
    expect(rig.commits).toEqual(["Display transform"]);
  });
});

describe("sliders", () => {
  it("show upstream's display units at the defaults", () => {
    mount();
    expect(field("Contrast").value).toBe("0");
    expect(field("Contrast pivot").value).toBe("0");
    expect(field("Toe power").value).toBe("0");
    expect(field("Input exposure").value).toBe("0");
    expect(field("Peak luminance").value).toBe("0");
  });

  it("store the param a display value stands for, one commit per gesture", () => {
    mount();
    type("Contrast", "50");
    expect(params().contrast).toBeCloseTo(3.25, 12);
    type("Contrast pivot", "-20");
    expect(params().contrast_pivot).toBeCloseTo(0.3, 12);
    type("Shoulder power", "100");
    expect(params().shoulder_power).toBeCloseTo(2, 12);
    expect(rig.commits).toEqual(["Contrast", "Contrast pivot", "Shoulder power"]);
  });

  it("hold a typed value to the param's range", () => {
    mount();
    type("Input exposure", "5");
    expect(params().input_exposure).toBe(2);
  });

  it("show the older-processing note on a version 1 photo", () => {
    mount({ processVersion: 1 });
    expect(screen.getByText(OLDER_PROCESSING)).toBeTruthy();
  });
});

describe("the X/Z lock", () => {
  it("starts locked: one strength drives both axes, with a balance", () => {
    mount();
    expect(queryField("Z-axis chroma contrast")).toBeNull();
    type("Chroma contrast", "40");
    expect(params().chroma_x_contrast).toBeCloseTo(4, 12);
    expect(params().chroma_z_contrast).toBeCloseTo(4, 12);
    type("X/Z balance", "50");
    expect(params().chroma_x_contrast).toBeCloseTo(4, 12);
    expect(params().chroma_z_contrast).toBeCloseTo(2, 12);
    type("Chroma contrast", "60");
    expect(params().chroma_z_contrast).toBeCloseTo(3, 12);
  });

  it("unlocked, shows each axis and its pivot on its own", () => {
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Lock X and Z" }));
    expect(queryField("X/Z balance")).toBeNull();
    type("Z-axis chroma contrast", "25");
    type("X-axis contrast pivot", "-10");
    expect(params()).toMatchObject({ chroma_x_contrast: 0, chroma_z_contrast: 2.5, chroma_x_pivot: 40, chroma_z_pivot: 50 });
    expect(rig.settings.get("chromaLocked")).toBe(false);
  });

  it("resets both axes in one step", () => {
    mount({ bag: qualify(TRANSFORM_ID, { chroma_x_contrast: 3, chroma_z_contrast: 1, chroma_x_pivot: 40, chroma_z_pivot: 60 }) });
    fireEvent.click(screen.getByRole("button", { name: "Reset chroma contrast" }));
    expect(params()).toMatchObject({ chroma_x_contrast: 0, chroma_z_contrast: 0, chroma_x_pivot: 50, chroma_z_pivot: 50 });
    expect(rig.commits).toEqual(["Reset chroma contrast"]);
  });
});

describe("looks", () => {
  it("show the look opacity for a colour look only", () => {
    mount();
    expect(queryField("Look opacity")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Colour look" }), { target: { value: "5" } });
    expect(params().color_look).toBe(5);
    expect(queryField("Look opacity")).toBeTruthy();
  });

  it("monochrome hides the colour-only sliders and names the filters", () => {
    mount({ bag: qualify(TRANSFORM_ID, { color_look: 11 }) });
    for (const gone of ["Vibrance", "Chromatic boost", "Abney rotation", "Look opacity"]) expect(queryField(gone)).toBeNull();
    expect(queryField("Green filter")).toBeTruthy();
    expect(queryField("Warm/cool filter strength")).toBeTruthy();
    expect(queryField("Warm/cool balance")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Lock X and Z" }));
    expect(queryField("Warm (red) filter")).toBeTruthy();
    expect(queryField("Cool (blue) filter")).toBeTruthy();
  });
});

describe("auto adjust", () => {
  // A lit wedge from -6 to +6 EV around grey, in linear Rec.2020.
  const wedge = () => frameOf(64, 4, (x) => {
    const v = 0.18 * 2 ** (-6 + (12 * x) / 63);
    return [v, v, v];
  });

  it("measures the scene in Rec.2020 and writes the tone settings in one step", async () => {
    mount({ frame: wedge() });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Auto adjust" })));
    expect(rig.captures).toEqual([{ point: "scene", space: { encoding: "linear", primaries: "rec2020" } }]);
    expect(rig.commits).toEqual(["Auto adjust"]);
    expect(params().contrast).not.toBe(DEFAULTS.contrast);
    expect(params().vibrance).toBe(DEFAULTS.vibrance);
  });

  it("explains a black frame and leaves the settings", async () => {
    mount({ frame: frameOf(4, 4, () => [0, 0, 0]) });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Auto adjust" })));
    expect(screen.getByText(AUTO_NO_FRAME)).toBeTruthy();
    expect(rig.commits).toEqual([]);
  });

  it("is off where the build can't measure the scene", () => {
    mount({ frame: "missing" });
    const button = screen.getByRole("button", { name: "Auto adjust" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe(AUTO_UNSUPPORTED);
  });

  it("remembers the rendering", () => {
    mount();
    fireEvent.change(screen.getByRole("combobox", { name: "Auto adjust rendering" }), { target: { value: "2" } });
    expect(rig.settings.get("autoMode")).toBe(2);
  });
});

describe("reset", () => {
  it("puts back upstream's defaults in one step", () => {
    mount({ bag: qualify(TRANSFORM_ID, { contrast: 4, color_look: 3 }) });
    act(() => resetActive());
    expect(params()).toEqual(DEFAULTS);
    expect(rig.commits).toEqual(["3D Colorimetric Film reset"]);
  });
});

describe("advanced", () => {
  it("opens on demand with the detail recovery, the roll-off and the gamut", () => {
    mount();
    expect(queryField("Detail recovery")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show advanced" }));
    expect(field("Detail recovery").value).toBe("+20");
    type("Detail recovery", "0");
    expect(params().hl_detail_recovery).toBe(0);
    expect(rig.settings.get("advancedOpen")).toBe(true);
  });
});
