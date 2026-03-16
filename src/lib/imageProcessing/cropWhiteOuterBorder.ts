import sharp from "sharp";

const DEFAULT_WHITE_THRESHOLD = 235;
const DEFAULT_EDGE_TOLERANCE = 0.02;

/**
 * Removes white outer border by scanning from each edge inward.
 * A row/column counts as "border" if at least (1 - edgeTolerance) of its
 * pixels have R,G,B >= whiteThreshold. Scans the full image (no scan limit).
 * Final crop is expanded to preserve the original aspect ratio.
 */
export async function cropWhiteOuterBorderKeepAspectRatio(
  inputBuffer: Buffer,
  options?: {
    whiteThreshold?: number;
    edgeTolerance?: number;
  }
): Promise<Buffer> {
  const whiteThreshold = options?.whiteThreshold ?? DEFAULT_WHITE_THRESHOLD;
  const edgeTolerance = options?.edgeTolerance ?? DEFAULT_EDGE_TOLERANCE;

  const meta = await sharp(inputBuffer).metadata();
  const w = meta.width!;
  const h = meta.height!;
  if (!w || !h) throw new Error("Invalid image dimensions");

  const raw = await sharp(inputBuffer).ensureAlpha().removeAlpha().raw().toBuffer();
  const bytesPerPixel = 3;
  const rowStride = w * bytesPerPixel;

  const pixelIsWhite = (offset: number): boolean =>
    raw[offset] >= whiteThreshold &&
    raw[offset + 1] >= whiteThreshold &&
    raw[offset + 2] >= whiteThreshold;

  const rowWhiteRatio = (y: number): number => {
    let white = 0;
    const base = y * rowStride;
    for (let x = 0; x < w; x++) {
      if (pixelIsWhite(base + x * bytesPerPixel)) white++;
    }
    return white / w;
  };

  const colWhiteRatio = (x: number): number => {
    let white = 0;
    for (let y = 0; y < h; y++) {
      if (pixelIsWhite(y * rowStride + x * bytesPerPixel)) white++;
    }
    return white / h;
  };

  const minWhiteRatio = 1 - edgeTolerance;

  let top = 0;
  while (top < h && rowWhiteRatio(top) >= minWhiteRatio) top++;

  let bottom = h - 1;
  while (bottom >= top && rowWhiteRatio(bottom) >= minWhiteRatio) bottom--;

  let left = 0;
  while (left < w && colWhiteRatio(left) >= minWhiteRatio) left++;

  let right = w - 1;
  while (right >= left && colWhiteRatio(right) >= minWhiteRatio) right--;

  if (left > right || top > bottom) {
    return sharp(inputBuffer).toBuffer();
  }

  let x1 = left;
  let y1 = top;
  let x2 = right;
  let y2 = bottom;
  const cw = x2 - x1 + 1;
  const ch = y2 - y1 + 1;
  const origAspect = w / h;
  const contentAspect = cw / ch;

  if (Math.abs(contentAspect - origAspect) > 1e-6) {
    if (contentAspect > origAspect) {
      const targetH = Math.round(cw / origAspect);
      const pad = Math.floor((targetH - ch) / 2);
      y1 = Math.max(0, top - pad);
      y2 = Math.min(h - 1, y1 + targetH - 1);
      y1 = Math.max(0, y2 - targetH + 1);
    } else {
      const targetW = Math.round(ch * origAspect);
      const pad = Math.floor((targetW - cw) / 2);
      x1 = Math.max(0, left - pad);
      x2 = Math.min(w - 1, x1 + targetW - 1);
      x1 = Math.max(0, x2 - targetW + 1);
    }
  }

  const outW = x2 - x1 + 1;
  const outH = y2 - y1 + 1;

  return sharp(inputBuffer)
    .extract({ left: x1, top: y1, width: outW, height: outH })
    .toBuffer();
}

/*
  Usage:

  import { cropWhiteOuterBorderKeepAspectRatio } from "@/lib/imageProcessing/cropWhiteOuterBorder";

  const processed = await cropWhiteOuterBorderKeepAspectRatio(buffer);
  const withOptions = await cropWhiteOuterBorderKeepAspectRatio(buffer, {
    whiteThreshold: 235,
    edgeTolerance: 0.02,
  });
*/
