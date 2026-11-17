# 3D Colorimetric Film

A Safelight extension that adds **3D Colorimetric Film**, a display transform
(tone mapper) with all of its sliders, and a panel in Develop to edit it. It
needs Safelight 3.2.6 or later.

It works in CIE XYZ. Luminance goes through a single-stage tone scale (the
ACES 2.0 one, set by a peak luminance), then a contrast curve around a pivot
with its own toe and shoulder and a mid-tones power. Chromaticity rides along
with the new luminance and rolls off toward the spectral locus, the way film
dyes limit saturation, so bright colours drift to white rather than clip.
Highlights can bleach and rotate in hue as they compress, and a detail
recovery puts back the local contrast the tone scale smoothed in them.

Pick it per photo from the display transform menu in Develop's bottom bar,
or as the default in Preferences ▸ Rendering. The panel shows its settings
while the open photo uses it, and a button to switch to it otherwise.

## The panel

- **Curve:** scene exposure from −6 to +4 EV against display output: the tone
  scale alone (faint), with the contrast curve, and with the mid-tones
  (solid), with mid-grey and the pivot's level marked.
- **Tone:** Auto adjust (Contrasty, Neutral or Soft), Input exposure, Peak
  luminance, Contrast, Contrast pivot, Shoulder power, Toe power, Mid-tones.
- **Colour:** Colour look (ten looks and Monochrome) with its opacity,
  Vibrance, Chromatic boost, chroma contrast on the CIE X and Z axes (locked
  together with a balance, or each with its own pivot), and Abney rotation.
  In the monochrome look the X and Z sliders become warm and cool colour
  filters, with a green filter beside them.
- **Advanced:** Highlight roll-off, Detail recovery and the roll-off's threshold, Gamut knee and
  steepness, and the Display target whose primaries colours are pulled into.

Auto adjust measures the scene the transform receives, over what the view
shows, and sets exposure, peak luminance and the pivot from it, then contrast,
toe and shoulder in the chosen rendering. Exposure, peak and pivot come out
the same in all three renderings.

## Differences from the original module

- **Detail recovery guides its filter with luminance.** The original
  separates the detail with a guided filter that the pixel's colour guides
  (a 3×3 solve over 13 filtered planes); it filters the luminance, so here
  the luminance guides itself, which fits the GPU's four-channel passes. It
  runs as the transform's pre-pass, over the image as it enters the
  transform. On two photos at the default 20% the result stayed within a
  mean ΔE2000 of 0.03–0.05 of the original's (99th percentile 0.31–0.37;
  the recovery itself moves pixels by a mean of 0.10–0.17), and at 100%
  within 0.08–0.15 (99th percentile 0.9–1.2). The filter's radius is the
  original's at full size, max(4, 8 × diagonal / 8848) pixels, scaled to
  the resolution Safelight works at, so Develop, thumbnails and exports
  agree; the original's own preview uses that many pixels of the smaller
  preview instead.
- **Auto adjust measures the whole view.** The original can also anchor
  exposure on a grey point picked on the image; Safelight has no picker for
  extensions, so this uses the original's measurement without a pick.
- **The crosshair adjustment** (hovering the image and scrolling to move the
  contrast sliders) is not ported.
- **Chroma contrast is computed exactly.** The original normalises its
  chroma sigmoid by subtracting two nearly equal 32-bit floats. At a chroma
  contrast of 0% (the default) the sigmoid's gain is held at 0.0001, the
  difference keeps about two significant digits, and bright saturated pixels
  pick up a few percent of noise in a channel. This extension evaluates the
  same function in a form that doesn't cancel, so it renders what the
  original renders at any gain from about 0.1 up, and the noise-free value
  below that.
- **Hues 342° to 359°.** The original's per-hue gamut table is declared with
  360 entries but lists 342, so the last 18 degrees read 0 and the gamut knee
  collapses there. This extension keeps that, as it is what the original
  renders.

## How it's tested

- `npm test`: the TypeScript twin of the shader against the original's own C,
  compiled with gcc from `src/iop/3dcf.c` by `npm run reference` (which
  writes `test/reference/fixtures.json`): the derived context, the tone curve
  and 168 pixels over 94 settings, to 32-bit float precision. The detail
  recovery over a test scene against the original's process() with the
  grey-guided filter, to float precision, and with its colour-guided one,
  within a bound. Auto adjust against the original's on a test scene, the
  X/Z lock, and the panel.
- `npm run test:gpu`: the shader and the detail pre-pass on Safelight's real
  renderer (headless Chromium on SwiftShader) against the twin, over 17
  settings on process versions 2 and 3. It needs a SafeLight checkout beside this folder, or
  `SAFELIGHT_CORE`.

## Credits and licence

A port of the 3D Colorimetric Film module from Christian Bouhon's
[libre-dt-lab](https://github.com/Christian-Bouhon/libre-dt-lab)
(`src/iop/3dcf.c`, commit ccb00d1b9), © 2026 darktable developers and Libre
DT-lab Edition © 2026 Christian Bouhon. Its tone scale is the ACES 2.0
single-stage tone scale; its gamut roll-off was inspired by Andrea Volpato's
spektrafilm, and its chroma contrast by Ohnishi Yasuo's XYZ sigmoid curve
plug-in.

GPL-3.0-or-later. See [LICENSE](LICENSE).
