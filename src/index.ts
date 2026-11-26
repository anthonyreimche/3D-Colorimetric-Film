// 3D Colorimetric Film, a Safelight extension. GPL-3.0-or-later. See LICENSE.
//
// A port of libre-dt-lab's 3D Colorimetric Film module (src/iop/3dcf.c,
// Christian Bouhon) as a Safelight display transform. The core runs derive
// on the main thread and binds the results; the GLSL is per-pixel. The panel
// edits the settings while the open photo renders with the transform.

import { FilmPanel, PANEL_TITLE, resetActive } from "./panel/Panel";
import { initRuntime } from "./runtime";
import type { SafelightAPI } from "./safelight";
import { colorimetricFilmTransform } from "./transform";

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  host.registerPipeline(colorimetricFilmTransform());
  host.registerPanel({
    id: "colorimetric-film.panel",
    title: PANEL_TITLE,
    component: FilmPanel,
    defaultDock: { module: "develop", direction: "right", order: 4, width: 268 },
    modules: ["develop"],
    onReset: resetActive,
  });
}

/** The host sweeps a deactivated extension's transform and panel itself. */
export function deactivate(): void {}
