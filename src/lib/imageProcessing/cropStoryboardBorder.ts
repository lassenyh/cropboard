import sharp from "sharp";

const DEBUG = false;

const NEAR_WHITE_MIN = 100;
const BORDER_RATIO_THRESHOLD = 0.09;
const MAX_SCAN_FRACTION = 0.36;

const SAFETY_TRIM_TOP = 1;
const SAFETY_TRIM_LEFT = 1;
const SAFETY_TRIM_RIGHT = 2;
const SAFETY_TRIM_BOTTOM = 3;

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= NEAR_WHITE_MIN && g >= NEAR_WHITE_MIN && b >= NEAR_WHITE_MIN;
}

function getRowNearWhiteRatio(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  y: number
): number {
  let white = 0;
  const count = width;
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    if (isNearWhite(data[i], data[i + 1], data[i + 2])) white++;
  }
  return white / count;
}

function getColumnNearWhiteRatio(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number
): number {
  let white = 0;
  const count = height;
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * channels;
    if (isNearWhite(data[i], data[i + 1], data[i + 2])) white++;
  }
  return white / count;
}

function detectTopCrop(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): number {
  const maxScan = Math.max(1, Math.floor(height * MAX_SCAN_FRACTION));
  for (let y = 0; y < maxScan; y++) {
    const ratio = getRowNearWhiteRatio(data, width, height, channels, y);
    if (ratio < BORDER_RATIO_THRESHOLD) return y;
  }
  return 0;
}

function detectBottomCrop(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): number {
  const maxScan = Math.max(1, Math.floor(height * MAX_SCAN_FRACTION));
  for (let d = 0; d < maxScan; d++) {
    const y = height - 1 - d;
    if (y < 0) break;
    const ratio = getRowNearWhiteRatio(data, width, height, channels, y);
    if (ratio < BORDER_RATIO_THRESHOLD) return d;
  }
  return 0;
}

function detectLeftCrop(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): number {
  const maxScan = Math.max(1, Math.floor(width * MAX_SCAN_FRACTION));
  for (let x = 0; x < maxScan; x++) {
    const ratio = getColumnNearWhiteRatio(data, width, height, channels, x);
    if (ratio < BORDER_RATIO_THRESHOLD) return x;
  }
  return 0;
}

function detectRightCrop(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): number {
  const maxScan = Math.max(1, Math.floor(width * MAX_SCAN_FRACTION));
  for (let d = 0; d < maxScan; d++) {
    const x = width - 1 - d;
    if (x < 0) break;
    const ratio = getColumnNearWhiteRatio(data, width, height, channels, x);
    if (ratio < BORDER_RATIO_THRESHOLD) return d;
  }
  return 0;
}

/**
 * Detects the visible white outer border on each edge and crops it away.
 * Each side is analyzed independently; aspect ratio is not preserved.
 * If detection would leave invalid dimensions, returns the original buffer.
 */
export async function cropStoryboardBorder(inputBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(inputBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) return inputBuffer;

  const raw = await sharp(inputBuffer).ensureAlpha().removeAlpha().raw().toBuffer();
  const expected3 = width * height * 3;
  const expected4 = width * height * 4;
  const channels = raw.length === expected3 ? 3 : raw.length === expected4 ? 4 : 0;
  if (channels === 0) return inputBuffer;

  let cropTop = detectTopCrop(raw, width, height, channels);
  let cropBottom = detectBottomCrop(raw, width, height, channels);
  let cropLeft = detectLeftCrop(raw, width, height, channels);
  let cropRight = detectRightCrop(raw, width, height, channels);

  cropTop = Math.min(cropTop + SAFETY_TRIM_TOP, height - 1);
  cropBottom = Math.min(cropBottom + SAFETY_TRIM_BOTTOM, height - 1);
  cropLeft = Math.min(cropLeft + SAFETY_TRIM_LEFT, width - 1);
  cropRight = Math.min(cropRight + SAFETY_TRIM_RIGHT, width - 1);

  const cropWidth = width - cropLeft - cropRight;
  const cropHeight = height - cropTop - cropBottom;

  if (cropWidth < 1 || cropHeight < 1) {
    if (DEBUG) console.warn("cropStoryboardBorder: invalid crop dimensions, returning original");
    return inputBuffer;
  }

  if (DEBUG) {
    console.log("cropStoryboardBorder", {
      width,
      height,
      cropTop,
      cropRight,
      cropBottom,
      cropLeft,
      cropWidth,
      cropHeight,
      threshold: BORDER_RATIO_THRESHOLD,
      nearWhiteMin: NEAR_WHITE_MIN,
    });
  }

  return sharp(inputBuffer)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .toBuffer();
}
