/*
    Reference harness for 3D Colorimetric Film. build.mjs compiles it with
    sections of libre-dt-lab's src/iop/3dcf.c copied verbatim (tdcf_core.c),
    so the expected values come from upstream's own code, compiled as C.

    process_pixel transcribes the per-pixel body of process() (3dcf.c
    L2726-2788 at ccb00d1b9) without the detail recovery, which needs the
    guided filter over the whole image.

    This file is part of the 3D Colorimetric Film extension for Safelight.
    Copyright (C) 2026 darktable developers; Libre DT-lab Edition (C) 2026
    Christian Bouhon (the transcribed process() body). GPL-3.0-or-later.

    Commands on stdin, one per line:
      P <23 params in struct order>   set the params
      X                               print the derived context
      R <r> <g> <b>                   print the pixel (Rec.2020 D50 in and out)
      Y <y_scene>                     print dt_st_compute_y_tm and the gamma'd curve
      A <mode> <picked> <w> <h> <rgb...>  print auto_adjust_3dcf_params's params
      D <w> <h> <grey> <rgb...>       print process() over the image, with
                                      the detail recovery (grey: 1 for the
                                      grey-guided filter)
*/

#include "tdcf_core.c"
#include <float.h>

/* Box mean over (2r+1) x (2r+1), each window clipped to the image and
   averaged over the pixels inside it, as src/common/box_filters.cc
   _blur_horizontal/_blur_vertical do (their Kahan sums in doubles here).
   `n` planes of w*h, in place. */
static void box_mean(float *planes, int n, int w, int h, int r)
{
  double *row = malloc(sizeof(double) * (size_t)(w > h ? w : h));
  for(int k = 0; k < n; k++)
  {
    float *pl = planes + (size_t)k * w * h;
    for(int y = 0; y < h; y++)
    {
      for(int x = 0; x < w; x++) row[x] = pl[(size_t)y * w + x];
      for(int x = 0; x < w; x++)
      {
        double s = 0.0;
        int c = 0;
        for(int i = x - r; i <= x + r; i++)
          if(i >= 0 && i < w) { s += row[i]; c++; }
        pl[(size_t)y * w + x] = (float)(s / c);
      }
    }
    for(int x = 0; x < w; x++)
    {
      for(int y = 0; y < h; y++) row[y] = pl[(size_t)y * w + x];
      for(int y = 0; y < h; y++)
      {
        double s = 0.0;
        int c = 0;
        for(int i = y - r; i <= y + r; i++)
          if(i >= 0 && i < h) { s += row[i]; c++; }
        pl[(size_t)y * w + x] = (float)(s / c);
      }
    }
  }
  free(row);
}

/* src/common/guided_filter.c _guided_filter_tiling, untiled (its overlap of
   3r makes the tiles exact): `guide` is RGB (stride 3), `in` one plane,
   eps = sqrt_eps^2, guide_weight 1, the result clamped to [lo, hi]. */
static void guided_filter_rgb(const float *guide, const float *in, float *out, int w, int h, int r,
                              float sqrt_eps, float lo, float hi)
{
  const size_t n = (size_t)w * h;
  const float eps = sqrt_eps * sqrt_eps;
  float *m = malloc(sizeof(float) * n * 13);
  for(size_t i = 0; i < n; i++)
  {
    const float *g = guide + 3 * i;
    const float p = in[i];
    const float v[13] = { p, g[0], g[1], g[2], g[0] * p, g[1] * p, g[2] * p,
                          g[0] * g[0], g[0] * g[1], g[0] * g[2], g[1] * g[1], g[1] * g[2], g[2] * g[2] };
    for(int k = 0; k < 13; k++) m[k * n + i] = v[k];
  }
  box_mean(m, 13, w, h, r);
  float *ab = malloc(sizeof(float) * n * 4);
  for(size_t i = 0; i < n; i++)
  {
    const float inp = m[i], gr = m[n + i], gg = m[2 * n + i], gb = m[3 * n + i];
    const float S00 = m[7 * n + i] - gr * gr + eps;
    const float S01 = m[8 * n + i] - gr * gg;
    const float S02 = m[9 * n + i] - gr * gb;
    const float S11 = m[10 * n + i] - gg * gg + eps;
    const float S12 = m[11 * n + i] - gg * gb;
    const float S22 = m[12 * n + i] - gb * gb + eps;
    const float det0 = S00 * (S11 * S22 - S12 * S12) - S01 * (S01 * S22 - S02 * S12) + S02 * (S01 * S12 - S02 * S11);
    float ar, ag, abl, b;
    if(fabsf(det0) > 4.f * FLT_EPSILON)
    {
      const float cr = m[4 * n + i] - gr * inp, cg = m[5 * n + i] - gg * inp, cb = m[6 * n + i] - gb * inp;
      const float det1 = cr * (S11 * S22 - S12 * S12) - S01 * (cg * S22 - cb * S12) + S02 * (cg * S12 - cb * S11);
      const float det2 = S00 * (cg * S22 - cb * S12) - cr * (S01 * S22 - S02 * S12) + S02 * (S01 * cb - S02 * cg);
      const float det3 = S00 * (S11 * cb - S12 * cg) - S01 * (S01 * cb - S02 * cg) + cr * (S01 * S12 - S02 * S11);
      ar = det1 / det0;
      ag = det2 / det0;
      abl = det3 / det0;
      b = inp - ar * gr - ag * gg - abl * gb;
    }
    else
    {
      ar = ag = abl = 0.f;
      b = inp;
    }
    ab[i] = ar; ab[n + i] = ag; ab[2 * n + i] = abl; ab[3 * n + i] = b;
  }
  free(m);
  box_mean(ab, 4, w, h, r);
  for(size_t i = 0; i < n; i++)
  {
    const float *g = guide + 3 * i;
    const float res = ab[i] * g[0] + ab[n + i] * g[1] + ab[2 * n + i] * g[2] + ab[3 * n + i];
    out[i] = res > hi ? hi : (res < lo ? lo : res);
  }
  free(ab);
}

/* The grey-guided filter the GPU port runs: the luminance guides itself. */
static void guided_filter_grey(const float *in, float *out, int w, int h, int r, float sqrt_eps, float lo, float hi)
{
  const size_t n = (size_t)w * h;
  const float eps = sqrt_eps * sqrt_eps;
  float *m = malloc(sizeof(float) * n * 2);
  for(size_t i = 0; i < n; i++) { m[i] = in[i]; m[n + i] = in[i] * in[i]; }
  box_mean(m, 2, w, h, r);
  for(size_t i = 0; i < n; i++)
  {
    const float mean = m[i], var = m[n + i] - mean * mean;
    const float a = var / (var + eps);
    m[i] = a;
    m[n + i] = mean - a * mean;
  }
  box_mean(m, 2, w, h, r);
  for(size_t i = 0; i < n; i++)
  {
    const float res = m[i] * in[i] + m[n + i];
    out[i] = res > hi ? hi : (res < lo ? lo : res);
  }
  free(m);
}

static void process_pixel(const dt_iop_3dcf_params_t *p, const dt_st_context_t *ctx,
                          const float in[3], float out[3])
{
  const int look_idx = (p->color_look > 0 && p->color_look <= 10) ? p->color_look : 0;
  const float *const mat = (look_idx > 0) ? color_looks[look_idx] : NULL;
  const float look_opacity = p->look_opacity;

  float rgb_in[3] = { in[0], in[1], in[2] };
  float rgb_out[3];
  for(int c = 0; c < 3; c++)
    rgb_in[c] = isfinite(rgb_in[c]) ? fmaxf(rgb_in[c], 0.0f) : 0.0f;

  {
    const float lum = fmaxf(fmaxf(rgb_in[0], rgb_in[1]), rgb_in[2]);
    const float w = st_desat_weight(lum * ctx->exposure_factor, ctx->hl_desat, ctx->hl_desat_threshold);
    if(w > 0.0f && isfinite(w))
    {
      const float t = fminf(w, 1.0f);
      const float ts = (t * t) / (t * t + (1.0f - t) * (1.0f - t) + 1e-6f);
      if(isfinite(ts) && ts > 0.0f)
      {
        for(int c = 0; c < 3; c++)
          rgb_in[c] = rgb_in[c] * (1.0f - ts) + lum * ts;
      }
    }
  }

  dt_st_pipeline_eval(rgb_in, rgb_out, ctx);

  if(mat)
  {
    const float r = rgb_out[0], g = rgb_out[1], b = rgb_out[2];
    const float tr = r * mat[0] + g * mat[1] + b * mat[2];
    const float tg = r * mat[3] + g * mat[4] + b * mat[5];
    const float tb = r * mat[6] + g * mat[7] + b * mat[8];
    rgb_out[0] = r * (1.0f - look_opacity) + tr * look_opacity;
    rgb_out[1] = g * (1.0f - look_opacity) + tg * look_opacity;
    rgb_out[2] = b * (1.0f - look_opacity) + tb * look_opacity;
    for(int i = 0; i < 3; i++) rgb_out[i] = fmaxf(rgb_out[i], 0.0f);
  }

  out[0] = rgb_out[0];
  out[1] = rgb_out[1];
  out[2] = rgb_out[2];
}

/* process() over a whole image with the detail recovery (3dcf.c L2652-2837):
   the guided filter's base of the exposure-scaled luminance, then each pixel
   as process_pixel does, its luminance re-scaled by the detail the tone
   mapping smoothed. `grey` swaps upstream's colour-guided filter for the
   grey-guided one the GPU port runs. The radius follows the image's own
   diagonal, as an export at full size does. */
static void process_image(const dt_iop_3dcf_params_t *p, const dt_st_context_t *ctx, const float *in, float *out,
                          int w, int h, int grey)
{
  const size_t n = (size_t)w * h;
  const float hl_detail_recovery = ctx->hl_detail_recovery;
  float *lum = NULL, *base = NULL, *guide = NULL;
  if(hl_detail_recovery > 0.0f)
  {
    lum = malloc(sizeof(float) * n);
    base = malloc(sizeof(float) * n);
    guide = malloc(sizeof(float) * n * 3);
    const float bf = ctx->exposure_factor;
    const float *lc = ctx->luma_coeff;
    for(size_t k = 0; k < n; k++)
    {
      float r = in[3 * k], g = in[3 * k + 1], b = in[3 * k + 2];
      r = isfinite(r) ? fmaxf(r, 0.0f) : 0.0f;
      g = isfinite(g) ? fmaxf(g, 0.0f) : 0.0f;
      b = isfinite(b) ? fmaxf(b, 0.0f) : 0.0f;
      r *= bf; g *= bf; b *= bf;
      guide[3 * k] = r; guide[3 * k + 1] = g; guide[3 * k + 2] = b;
      lum[k] = lc[0] * r + lc[1] * g + lc[2] * b;
    }
    const float diag = sqrtf((float)w * w + (float)h * h);
    const int gf_radius = fmaxf(4.0f, 8.0f * diag / 8848.0f);
    if(grey) guided_filter_grey(lum, base, w, h, gf_radius, 0.05f, 0.0f, FLT_MAX);
    else guided_filter_rgb(guide, lum, base, w, h, gf_radius, 0.05f, 0.0f, FLT_MAX);
  }
  for(size_t k = 0; k < n; k++)
  {
    float rgb_in[3] = { in[3 * k], in[3 * k + 1], in[3 * k + 2] };
    for(int c = 0; c < 3; c++) rgb_in[c] = isfinite(rgb_in[c]) ? fmaxf(rgb_in[c], 0.0f) : 0.0f;
    float lum_orig = 0.0f;
    if(hl_detail_recovery > 0.0f)
    {
      const float *lc = ctx->luma_coeff;
      lum_orig = (lc[0] * rgb_in[0] + lc[1] * rgb_in[1] + lc[2] * rgb_in[2]) * ctx->exposure_factor;
    }
    float hl_desat_factor = 0.0f;
    {
      const float l = fmaxf(fmaxf(rgb_in[0], rgb_in[1]), rgb_in[2]);
      const float wgt = st_desat_weight(l * ctx->exposure_factor, ctx->hl_desat, ctx->hl_desat_threshold);
      if(wgt > 0.0f && isfinite(wgt))
      {
        const float t = fminf(wgt, 1.0f);
        const float ts = (t * t) / (t * t + (1.0f - t) * (1.0f - t) + 1e-6f);
        hl_desat_factor = ts;
      }
    }
    float rgb_out[3];
    /* process_pixel repeats the sanitise and the pre-pipeline roll-off */
    process_pixel(p, ctx, &in[3 * k], rgb_out);
    if(hl_detail_recovery > 0.0f)
    {
      const float *lc = ctx->luma_coeff;
      const float lum_tm = lc[0] * rgb_out[0] + lc[1] * rgb_out[1] + lc[2] * rgb_out[2];
      if(lum_tm > 1e-6f && lum_orig > 1e-6f)
      {
        float detail = lum_orig - base[k];
        {
          const float t = fminf(hl_detail_recovery, 1.0f);
          const float detail_frac = 0.10f * (1.0f - t * 0.50f);
          const float bsteep_frac = 0.25f * (1.0f - t * 0.40f);
          const float dl = fmaxf(lum_orig * detail_frac, 1e-6f);
          const float da = fabsf(detail);
          if(da > dl)
          {
            const float excess = da - dl;
            const float bsteep = fmaxf(dl * bsteep_frac, 0.001f);
            const float compression = excess / (excess + bsteep);
            const float clamped_abs = dl + compression * bsteep;
            detail = copysignf(clamped_abs, detail);
          }
        }
        const float gain = lum_tm / lum_orig;
        const float lum_final = lum_tm + detail * hl_detail_recovery * (1.0f - hl_desat_factor) * gain;
        if(lum_final > 1e-6f)
        {
          const float scale = fmaxf(lum_final / lum_tm, 0.25f);
          rgb_out[0] *= scale; rgb_out[1] *= scale; rgb_out[2] *= scale;
        }
      }
    }
    out[3 * k] = rgb_out[0]; out[3 * k + 1] = rgb_out[1]; out[3 * k + 2] = rgb_out[2];
  }
  free(lum); free(base); free(guide);
}

static void print_floats(const char *name, const float *v, int n)
{
  printf("\"%s\":[", name);
  for(int i = 0; i < n; i++) printf("%s%.9g", i ? "," : "", v[i]);
  printf("]");
}

static void print_context(const dt_st_context_t *c)
{
  printf("{");
  printf("\"exposure_factor\":%.9g,\"contrast\":%.9g,\"contrast_pivot\":%.9g,", c->exposure_factor, c->contrast, c->contrast_pivot);
  print_floats("input_matrix", c->input_matrix, 9); printf(",");
  print_floats("output_matrix", c->output_matrix, 9); printf(",");
  print_floats("luma_coeff", c->luma_coeff, 3); printf(",");
  printf("\"hl_desat\":%.9g,\"hl_desat_threshold\":%.9g,\"hl_rotation\":%.9g,", c->hl_desat, c->hl_desat_threshold, c->hl_rotation);
  printf("\"white_chroma_x\":%.9g,\"white_chroma_z\":%.9g,\"gamma\":%.9g,\"gamma_power\":%.9g,", c->white_chroma_x, c->white_chroma_z, c->gamma, c->gamma_power);
  printf("\"vibrance\":%.9g,\"chromatic_boost\":%.9g,\"gamut_knee\":%.9g,\"gamut_steepness\":%.9g,", c->vibrance, c->chromatic_boost, c->gamut_knee, c->gamut_steepness);
  printf("\"toe_power\":%.9g,\"shoulder_power\":%.9g,", c->toe_power, c->shoulder_power);
  print_floats("spectral_boundary", c->spectral_boundary, 360); printf(",");
  print_floats("gamut_fwd", c->gamut_fwd, 9); printf(",");
  print_floats("gamut_inv", c->gamut_inv, 9); printf(",");
  printf("\"gamut_enable\":%d,", c->gamut_enable);
  printf("\"ssts\":[%.17g,%.17g,%.17g,%.17g,%.17g,%.17g],", c->ssts.s_2, c->ssts.m_2, c->ssts.g, c->ssts.t_1, c->ssts.n_r, c->ssts.n);
  printf("\"chroma_x\":[%.9g,%.9g,%.9g,%.9g,%.9g],", c->chroma_x_gain, c->chroma_x_shift, c->chroma_x_sig0, c->chroma_x_inv_range, c->chroma_x_r05);
  printf("\"chroma_z\":[%.9g,%.9g,%.9g,%.9g,%.9g],", c->chroma_z_gain, c->chroma_z_shift, c->chroma_z_sig0, c->chroma_z_inv_range, c->chroma_z_r05);
  printf("\"mono_x_gain\":%.9g,\"mono_z_gain\":%.9g,\"monochrome\":%d", c->mono_x_gain, c->mono_z_gain, c->monochrome);
  printf("}\n");
}

static void print_params(const dt_iop_3dcf_params_t *p)
{
  printf("{\"contrast\":%.9g,\"contrast_pivot\":%.9g,\"toe_power\":%.9g,\"shoulder_power\":%.9g,"
         "\"input_exposure\":%.9g,\"peak_luminance\":%.9g}\n",
         p->contrast, p->contrast_pivot, p->toe_power, p->shoulder_power, p->input_exposure, p->peak_luminance);
}

int main(void)
{
  dt_iop_3dcf_params_t p;
  memset(&p, 0, sizeof(p));
  dt_st_context_t ctx;
  memset(&ctx, 0, sizeof(ctx));
  char cmd[4];
  while(scanf("%3s", cmd) == 1)
  {
    if(cmd[0] == 'P')
    {
      float f[23];
      for(int i = 0; i < 23; i++)
        if(scanf("%f", &f[i]) != 1) return 1;
      p.contrast = f[0];
      p.gamma = f[1];
      p.vibrance = f[2];
      p.chromatic_boost = f[3];
      p.peak_luminance = f[4];
      p.input_exposure = f[5];
      p.hl_hue_shift = f[6];
      p.hl_desaturation = f[7];
      p.hl_desat_threshold = f[8];
      p.gamut_knee = f[9];
      p.gamut_steepness = f[10];
      p.output_cs = (dt_iop_st_colorspace_t)(int)f[11];
      p.color_look = (dt_iop_st_look_t)(int)f[12];
      p.look_opacity = f[13];
      p.contrast_pivot = f[14];
      p.toe_power = f[15];
      p.shoulder_power = f[16];
      p.hl_detail_recovery = f[17];
      p.chroma_x_contrast = f[18];
      p.chroma_x_pivot = f[19];
      p.chroma_z_contrast = f[20];
      p.chroma_z_pivot = f[21];
      p.mono_green = f[22];
      st_compute_context(&p, &ctx);
    }
    else if(cmd[0] == 'X')
    {
      print_context(&ctx);
    }
    else if(cmd[0] == 'R')
    {
      float in[3], out[3];
      if(scanf("%f %f %f", &in[0], &in[1], &in[2]) != 3) return 1;
      process_pixel(&p, &ctx, in, out);
      printf("[%.9g,%.9g,%.9g]\n", out[0], out[1], out[2]);
    }
    else if(cmd[0] == 'Y')
    {
      float y;
      if(scanf("%f", &y) != 1) return 1;
      const float tm = dt_st_compute_y_tm(y, &ctx);
      float full = tm;
      if(ctx.gamma != 0.0f) full = powf(fminf(fmaxf(full, 0.0f), 1.0f), ctx.gamma_power);
      printf("[%.9g,%.9g]\n", tm, full);
    }
    else if(cmd[0] == 'D')
    {
      int w, h, grey;
      if(scanf("%d %d %d", &w, &h, &grey) != 3) return 1;
      const size_t n = (size_t)w * h;
      float *img = malloc(sizeof(float) * 3 * n), *res = malloc(sizeof(float) * 3 * n);
      for(size_t i = 0; i < 3 * n; i++)
        if(scanf("%f", &img[i]) != 1) return 1;
      process_image(&p, &ctx, img, res, w, h, grey);
      printf("[");
      for(size_t i = 0; i < 3 * n; i++) printf("%s%.9g", i ? "," : "", res[i]);
      printf("]\n");
      free(img); free(res);
    }
    else if(cmd[0] == 'A')
    {
      int mode, w, h;
      float picked;
      if(scanf("%d %f %d %d", &mode, &picked, &w, &h) != 4) return 1;
      float *buf = malloc(sizeof(float) * 4 * (size_t)w * h);
      for(int i = 0; i < w * h; i++)
      {
        if(scanf("%f %f %f", &buf[4 * i], &buf[4 * i + 1], &buf[4 * i + 2]) != 3) return 1;
        buf[4 * i + 3] = 0.0f;
      }
      dt_iop_3dcf_params_t q = p;
      auto_adjust_3dcf_params(buf, w, h, 4, &q, (dt_iop_st_auto_mode_t)mode, picked);
      free(buf);
      print_params(&q);
    }
    fflush(stdout);
  }
  return 0;
}
