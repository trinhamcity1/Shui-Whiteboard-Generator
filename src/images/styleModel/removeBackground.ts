import sharp from "sharp";

/**
 * Stopgap for the style-check candidates, which weren't generated with
 * "transparent background" in their prompt (unlike the real asset-library
 * template). Flood-fills from the image border inward, keying out any
 * pixel connected to the edge that's within `threshold` color distance of
 * the sampled background — connectivity to the border means clothing/skin
 * tones in the middle of the character survive even if they're similarly
 * light, since nothing in the interior touches the edge.
 *
 * This is not the real fix — the real fix is generating actual library
 * assets through a prompt that requests transparency in the first place.
 * It exists to unblock a same-day visual check, not to ship.
 */
export async function removeFlatBackground(args: {
  inputPath: string;
  outputPath: string;
  threshold?: number;
}): Promise<void> {
  const { inputPath, outputPath, threshold = 32 } = args;

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected RGBA raw buffer, got ${channels} channels.`);
  }

  const idx = (x: number, y: number) => (y * width + x) * 4;

  // Sample the background color from the four corners.
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [cx, cy] of corners) {
    const i = idx(cx!, cy!);
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  r /= corners.length;
  g /= corners.length;
  b /= corners.length;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const isBackground = (x: number, y: number) => {
    const i = idx(x, y);
    const dr = data[i]! - r;
    const dg = data[i + 1]! - g;
    const db = data[i + 2]! - b;
    return Math.sqrt(dr * dr + dg * dg + db * db) < threshold;
  };

  for (let x = 0; x < width; x++) {
    queue.push(x, 0, x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    queue.push(0, y, width - 1, y);
  }

  while (queue.length > 0) {
    const y = queue.pop()!;
    const x = queue.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    if (!isBackground(x, y)) continue;

    data[idx(x, y) + 3] = 0; // set alpha to 0

    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  // The candidate images bake in a lot of empty headroom around the
  // subject (a full painterly composition, not a tightly cropped asset),
  // which made a character look tiny when scaled by a fixed width next to
  // a diagram. Trim the now-transparent margins down to the subject's real
  // bounding box so callers can scale by *actual* character height.
  await sharp(data, { raw: { width, height, channels: 4 } }).trim().png().toFile(outputPath);
}
