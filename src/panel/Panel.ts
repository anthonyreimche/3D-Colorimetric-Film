// 3D Colorimetric Film, a Safelight extension. GPL-3.0-or-later. See LICENSE.

// The panel: the transform's settings while the open photo renders with it,
// laid out as upstream lays them out (controls.ts), or a way to switch to it.

import type { ReactElement, ReactNode } from "react";
import { AUTO_MODES, autoAdjust, captureScene, type AutoMode } from "../autotune";
import { COLOR_LOOK_NAMES, DEFAULTS, DISPLAY_TARGETS, MONOCHROME, PARAMS, type Params } from "../params";
import { qualify, readParams, unqualify, withinRange } from "../param-table";
import { api, h } from "../runtime";
import { TRANSFORM_ID, TRANSFORM_NAME } from "../transform";
import {
  ABNEY, CHROMATIC_BOOST, GAMUT, GREEN_FILTER, HIGHLIGHTS, LOOK_OPACITY, TONE, TOOLTIPS, VIBRANCE, chromaSliders, type SliderSpec,
} from "./controls";
import { CurveGraph } from "./Graph";
import { CHROMA_RESET, balanceEdit, balanceFromXZ, lockedEdit } from "./model";

export const PANEL_TITLE = TRANSFORM_NAME;
export const INACTIVE_HINT = "This photo uses another display transform. Switch to 3D Colorimetric Film to edit its settings here.";
export const OLDER_PROCESSING =
  "This photo uses the older processing, so Safelight's own highlight shoulder still runs before the transform. Use Update processing in Develop's status bar to give the transform the full range.";
export const AUTO_UNSUPPORTED = "Auto adjust needs a Safelight build that can measure the scene before the display transform.";
export const AUTO_NO_FRAME = "Nothing to measure: no photo is rendered yet, the frame is black, or this GPU has no float render targets.";

const LOCK_KEY = "chromaLocked";
const MODE_KEY = "autoMode";
const ADVANCED_KEY = "advancedOpen";

type Patch = Partial<Params>;

const decimals = (step: number): number => (String(step).split(".")[1] ?? "").length;

/** A value as its slider shows it: to the step's decimals plus a guard digit. Display only. */
const shown = (value: number, step: number): number => Number(value.toFixed(decimals(step) + 1));

const display = (s: Pick<SliderSpec, "scale" | "offset">, v: number): number => v * s.scale + s.offset;
const stored = (s: Pick<SliderSpec, "scale" | "offset">, v: number): number => (v - s.offset) / s.scale;

function choose(): void {
  const dev = api().stores.useDevelopStore.getState();
  dev.setParam("displayTransform", TRANSFORM_ID);
  void dev.commitEdit("Display transform");
}

/** Resets the open photo's settings to upstream's defaults (PanelContribution.onReset). */
export function resetActive(): void {
  const host = api();
  const dev = host.stores.useDevelopStore.getState();
  if (host.pipelines.effectiveId(dev.params.displayTransform) !== TRANSFORM_ID) return;
  dev.setDynParams(qualify(TRANSFORM_ID, DEFAULTS));
  void dev.commitEdit(`${TRANSFORM_NAME} reset`);
}

function Inactive(): ReactElement {
  const ui = api().ui;
  return h(
    ui.Stack,
    { gap: 8, style: { padding: 12 } },
    h("p", { style: { margin: 0, color: ui.tokens.textSecondary, fontSize: 11 } }, INACTIVE_HINT),
    h(ui.Row, { gap: 6, wrap: true }, h(ui.Button, { onClick: choose }, `Use ${TRANSFORM_NAME}`)),
  );
}

export function FilmPanel(): ReactElement {
  const host = api();
  const { useDevelopStore, usePipelineStore } = host.stores;
  const pick = useDevelopStore((s) => s.params.displayTransform);
  const processVersion = useDevelopStore((s) => s.params.processVersion);
  const photoId = useDevelopStore((s) => s.photoId);
  // A photo without a pick follows the Preferences default, so a change of it draws again.
  usePipelineStore((s) => s.activeId);
  if (host.pipelines.effectiveId(pick) !== TRANSFORM_ID) return h(Inactive, null);
  // Keyed per photo, so a new photo starts with no message and no gesture.
  return h(Body, { key: photoId, processVersion });
}

function Body({ processVersion }: { processVersion: number | undefined }): ReactElement {
  const host = api();
  const { useRef, useState } = host.react;
  const kit = host.ui;
  const dev = host.stores.useDevelopStore;
  const scope = host.develop.useParamScope();
  const [locked, setLocked] = useState<boolean>(() => host.settings.get(LOCK_KEY, true));
  const [mode, setMode] = useState<AutoMode>(() => host.settings.get<AutoMode>(MODE_KEY, 1));
  const [advanced, setAdvanced] = useState<boolean>(() => host.settings.get(ADVANCED_KEY, false));
  const [message, setMessage] = useState<string | null>(null);
  // The balance while both axes are 0, where the params can't hold it (upstream's slider keeps its own value).
  const [heldBalance, setHeldBalance] = useState(0);
  // A gesture's start: its params, the bag as it stored them, and the bag keys the gesture's writes have set.
  const started = useRef<{ from: Params; stored: Readonly<Record<string, unknown>>; keys: Set<string> } | null>(null);

  const read = (): Params => readParams(PARAMS, unqualify(TRANSFORM_ID, scope.getParams()));
  const p = read();
  const mono = p.color_look === MONOCHROME;
  const strength = Math.max(p.chroma_x_contrast, p.chroma_z_contrast);
  const balanceOf = (q: Params): number =>
    Math.max(q.chroma_x_contrast, q.chroma_z_contrast) > 1e-6 ? balanceFromXZ(q.chroma_x_contrast, q.chroma_z_contrast) : heldBalance;
  const balance = strength > 1e-6 ? balanceFromXZ(p.chroma_x_contrast, p.chroma_z_contrast) : heldBalance;

  const coupled = (from: Params, patch: Patch): Record<string, unknown> => {
    const held = withinRange(PARAMS, patch);
    return qualify(TRANSFORM_ID, withinRange(PARAMS, locked ? lockedEdit(from, held, balanceOf(from)) : held));
  };
  /** A menu, button or toggle: written and committed at once. */
  const write = (patch: Patch, label: string) => {
    scope.setParams(qualify(TRANSFORM_ID, withinRange(PARAMS, patch)));
    scope.commit(label);
  };
  const start = () => (started.current ??= { from: read(), stored: scope.getParams(), keys: new Set<string>() });
  // A slider gesture couples from the params it started from, so the frames of a drag or the keystrokes
  // of a typed number land where one jump to the last value would; a key an earlier write set goes back
  // to what the start stored unless this write sets it too.
  const lay = (next: Record<string, unknown>) => {
    const { stored: was, keys } = start();
    for (const k of Object.keys(next)) keys.add(k);
    const laid: Record<string, unknown> = {};
    for (const k of keys) laid[k] = k in next ? next[k] : was[k];
    scope.setParams(laid);
  };
  const commit = (label: string) => {
    started.current = null;
    scope.commit(label);
  };

  const slider = (s: SliderSpec, label = s.label): ReactNode => {
    const def = PARAMS[s.key];
    const a = display(s, def.min);
    const b = display(s, def.max);
    const now = shown(display(s, p[s.key] as number), s.step);
    return h(
      "div",
      { key: s.key, title: `${s.tooltip} (${s.unit === "EV" ? "In EV" : "In %"}.)` },
      h(host.components.Slider, {
        label,
        value: now,
        min: Math.min(a, b),
        max: Math.max(a, b),
        step: s.step,
        defaultValue: display(s, def.default),
        onChange: (v: number) => lay(coupled(start().from, { [s.key]: stored(s, v) })),
        onCommit: () => commit(label),
      }),
    );
  };

  const runAuto = async () => {
    setMessage(null);
    const photo = dev.getState().photoId;
    let frame: Awaited<ReturnType<typeof captureScene>>;
    try {
      frame = await captureScene(host);
    } catch {
      frame = "no frame";
    }
    // A capture belongs to the photo and the transform it started on.
    const now = dev.getState();
    if (now.photoId !== photo || host.pipelines.effectiveId(now.params.displayTransform) !== TRANSFORM_ID) return;
    if (frame === "unsupported") return setMessage(AUTO_UNSUPPORTED);
    const result = frame === "no frame" ? null : autoAdjust(frame.data, frame.width * frame.height, mode);
    if (!result) return setMessage(AUTO_NO_FRAME);
    write(result, "Auto adjust");
  };

  const chroma = chromaSliders(mono, locked);
  const lookActive = p.color_look >= 1 && p.color_look <= 10;
  const muted = { margin: 0, color: kit.tokens.textMuted, fontSize: 11 };

  const balanceSlider = h(
    "div",
    { key: "balance", title: `${chroma.balance.tooltip} (In %.)` },
    h(host.components.Slider, {
      label: chroma.balance.label,
      value: shown(balance * 100, 1),
      min: -100,
      max: 100,
      step: 1,
      defaultValue: 0,
      onChange: (v: number) => {
        const b = Math.min(Math.max(v / 100, -1), 1);
        setHeldBalance(b);
        lay(qualify(TRANSFORM_ID, withinRange(PARAMS, balanceEdit(start().from, b))));
      },
      onCommit: () => commit(chroma.balance.label),
    }),
  );
  const resetChroma = h(
    kit.Button,
    {
      key: "reset-chroma",
      size: "sm",
      variant: "ghost",
      title: TOOLTIPS.reset,
      onClick: () => {
        setHeldBalance(0);
        write(CHROMA_RESET, "Reset chroma contrast");
      },
    },
    "Reset chroma contrast",
  );

  const tone = h(
    kit.Section,
    { title: "Tone" },
    h(
      kit.Stack,
      { gap: 6 },
      h(
        kit.Row,
        { gap: 6 },
        h(kit.Select, {
          ariaLabel: "Auto adjust rendering",
          title: TOOLTIPS.mode,
          value: String(mode),
          options: AUTO_MODES.map((label, i) => ({ value: String(i), label })),
          onChange: (v: string) => {
            const m = Number(v) as AutoMode;
            host.settings.set(MODE_KEY, m);
            setMode(m);
          },
        }),
        h(
          kit.Button,
          { size: "sm", disabled: !host.develop.captureFloatFrame, title: host.develop.captureFloatFrame ? TOOLTIPS.auto : AUTO_UNSUPPORTED, onClick: () => void runAuto() },
          "Auto adjust",
        ),
      ),
      ...TONE.map((s) => slider(s)),
    ),
  );

  const colour = h(
    kit.Section,
    { title: "Colour" },
    h(
      kit.Stack,
      { gap: 6 },
      h(kit.Select, {
        ariaLabel: "Colour look",
        title: TOOLTIPS.look,
        value: String(p.color_look),
        options: COLOR_LOOK_NAMES.map((label, i) => ({ value: String(i), label })),
        onChange: (v: string) => write({ color_look: Number(v) }, "Colour look"),
      }),
      lookActive ? slider(LOOK_OPACITY) : null,
      mono ? null : slider(VIBRANCE),
      mono ? null : slider(CHROMATIC_BOOST),
      slider(chroma.x),
      h(
        "div",
        { key: "lock", title: TOOLTIPS.lock },
        h(kit.Toggle, {
          checked: locked,
          label: "Lock X and Z",
          onChange: (v: boolean) => {
            host.settings.set(LOCK_KEY, v);
            setLocked(v);
          },
        }),
      ),
      locked ? balanceSlider : slider(chroma.xPivot),
      locked ? null : slider(chroma.z),
      locked ? null : slider(chroma.zPivot),
      resetChroma,
      mono ? slider(GREEN_FILTER) : null,
      mono ? null : slider(ABNEY),
    ),
  );

  const toggleAdvanced = h(
    kit.Button,
    {
      variant: "ghost",
      size: "sm",
      "aria-label": `${advanced ? "Hide" : "Show"} advanced`,
      onClick: () => {
        host.settings.set(ADVANCED_KEY, !advanced);
        setAdvanced(!advanced);
      },
    },
    advanced ? "Hide" : "Show",
  );
  const advancedSection = h(
    kit.Section,
    { title: "Advanced", right: toggleAdvanced },
    advanced
      ? h(
          kit.Stack,
          { gap: 6 },
          h("p", { style: muted }, "Highlights"),
          ...HIGHLIGHTS.map((s) => slider(s)),
          h("p", { style: muted }, "Gamut"),
          ...GAMUT.map((s) => slider(s)),
          h(kit.Select, {
            ariaLabel: "Display target",
            title: TOOLTIPS.target,
            value: String(p.output_cs),
            options: DISPLAY_TARGETS.map((label, i) => ({ value: String(i), label })),
            onChange: (v: string) => write({ output_cs: Number(v) }, "Display target"),
          }),
        )
      : null,
  );

  // Core panels lay their content out inside a 12 px inset (px-3 py-3).
  return h(
    kit.Stack,
    { gap: 10, style: { padding: 12 } },
    (processVersion ?? 1) < 2 ? h("p", { style: muted }, OLDER_PROCESSING) : null,
    h(CurveGraph, { p }),
    tone,
    colour,
    advancedSection,
    message ? h("p", { style: { margin: 0, color: kit.tokens.textSecondary, fontSize: 11 } }, message) : null,
  );
}
