import { DIGIT_TEMPLATES, DIGIT_TEMPLATE_HEIGHT, DIGIT_TEMPLATE_WIDTH } from "@/lib/icon-import/digit-templates";

/**
 * 図鑑スクショの「No.xxxx」ラベルから番号を読む。外部の文字認識は使わない。
 * ゲームの数字は毎回同じ字体（白い塗り＋黒い縁取り）なので、
 * 1. 白い画素のかたまりを探す
 * 2. 下端がそろって並ぶ、背の高いかたまりを文字とみなす（絵の白い部分を除くため）
 * 3. 先頭の「N」を除いた残りを数字として、見本の形と照らし合わせる
 */

/** ImageData と同じ形（RGBA が並んだ配列）。ブラウザでも Node でも作れるように最小限にしている */
export type RgbaImage = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

const WHITE_THRESHOLD = 190;
const MIN_GLYPH_HEIGHT_RATIO = 0.5;
const MAX_GLYPH_HEIGHT_RATIO = 0.8;
/** 下端のそろい具合をまとめる幅（px） */
const BASELINE_BUCKET = 3;
/** 小文字の「o」と「.」を外すため、行の中で最も高い文字の 85% 以上だけ残す */
const TALL_GLYPH_RATIO = 0.85;
/** これより横長なら数字がくっついているとみなして分ける */
const MERGED_WIDTH_RATIO = 1.3;
const DIGIT_ASPECT = 0.85;
/** 図鑑No は 001 のように3桁以上で表示される */
const MIN_DIGITS = 3;
const MAX_DIGITS = 5;

type Component = { pixels: number[]; x0: number; x1: number; y0: number; y1: number };

function isWhite(image: RgbaImage, index: number): boolean {
  const offset = index * 4;
  return (
    image.data[offset] > WHITE_THRESHOLD &&
    image.data[offset + 1] > WHITE_THRESHOLD &&
    image.data[offset + 2] > WHITE_THRESHOLD
  );
}

/** 上下左右でつながった白い画素のかたまりを列挙する */
function findComponents(image: RgbaImage): Component[] {
  const { width, height } = image;
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];
  const stack: number[] = [];

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || !isWhite(image, start)) continue;
    visited[start] = 1;
    stack.push(start);
    const component: Component = { pixels: [], x0: width, x1: 0, y0: height, y1: 0 };

    while (stack.length > 0) {
      const index = stack.pop() as number;
      component.pixels.push(index);
      const x = index % width;
      const y = (index - x) / width;
      if (x < component.x0) component.x0 = x;
      if (x + 1 > component.x1) component.x1 = x + 1;
      if (y < component.y0) component.y0 = y;
      if (y + 1 > component.y1) component.y1 = y + 1;

      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || visited[neighbor] || !isWhite(image, neighbor)) continue;
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

/** かたまりの一部（横方向の範囲）を、見本と同じ大きさの 0/1 の並びに縮める */
function toGlyphBits(component: Component, imageWidth: number, fromX: number, toX: number): Uint8Array {
  const glyphWidth = toX - fromX;
  const glyphHeight = component.y1 - component.y0;
  const filled = new Uint8Array(glyphWidth * glyphHeight);
  for (const index of component.pixels) {
    const x = index % imageWidth;
    const y = (index - x) / imageWidth;
    if (x < fromX || x >= toX) continue;
    filled[(y - component.y0) * glyphWidth + (x - fromX)] = 1;
  }

  // 最近傍で縮める。見本も同じやり方で作っているので、多少の粗さは両者で打ち消し合う
  const bits = new Uint8Array(DIGIT_TEMPLATE_WIDTH * DIGIT_TEMPLATE_HEIGHT);
  for (let ty = 0; ty < DIGIT_TEMPLATE_HEIGHT; ty++) {
    const sourceY = Math.min(glyphHeight - 1, Math.floor(((ty + 0.5) * glyphHeight) / DIGIT_TEMPLATE_HEIGHT));
    for (let tx = 0; tx < DIGIT_TEMPLATE_WIDTH; tx++) {
      const sourceX = Math.min(glyphWidth - 1, Math.floor(((tx + 0.5) * glyphWidth) / DIGIT_TEMPLATE_WIDTH));
      bits[ty * DIGIT_TEMPLATE_WIDTH + tx] = filled[sourceY * glyphWidth + sourceX];
    }
  }
  return bits;
}

const TEMPLATE_BITS: [string, Uint8Array][] = Object.entries(DIGIT_TEMPLATES).map(([digit, pattern]) => [
  digit,
  Uint8Array.from(pattern, (character) => (character === "1" ? 1 : 0)),
]);

function classifyDigit(bits: Uint8Array): string {
  let bestDigit = "?";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [digit, template] of TEMPLATE_BITS) {
    let distance = 0;
    for (let index = 0; index < bits.length; index++) {
      if (bits[index] !== template[index]) distance++;
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDigit = digit;
    }
  }
  return bestDigit;
}

/**
 * ラベル帯の画像から図鑑No を読む。読めなければ null（隠れたマス・暗いラベルなど）。
 */
export function readMonsterNumber(label: RgbaImage): number | null {
  const bandHeight = label.height;
  const candidates = findComponents(label).filter((component) => {
    const glyphHeight = component.y1 - component.y0;
    return (
      component.y0 > 0 &&
      component.y1 < bandHeight &&
      glyphHeight >= MIN_GLYPH_HEIGHT_RATIO * bandHeight &&
      glyphHeight <= MAX_GLYPH_HEIGHT_RATIO * bandHeight
    );
  });
  if (candidates.length === 0) return null;

  // 文字は下端がそろう。最も多い下端の位置を文字の行とみなす
  const baselineCounts = new Map<number, number>();
  for (const component of candidates) {
    const bucket = Math.floor(component.y1 / BASELINE_BUCKET);
    baselineCounts.set(bucket, (baselineCounts.get(bucket) ?? 0) + 1);
  }
  const baseline = [...baselineCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const onLine = candidates.filter((component) => Math.abs(Math.floor(component.y1 / BASELINE_BUCKET) - baseline) <= 1);
  const tallest = Math.max(...onLine.map((component) => component.y1 - component.y0));
  const tall = onLine
    .filter((component) => component.y1 - component.y0 >= TALL_GLYPH_RATIO * tallest)
    .sort((a, b) => a.x0 - b.x0);
  if (tall.length < 2) return null;

  // 先頭は「N」。残りが数字
  let text = "";
  for (const component of tall.slice(1)) {
    const glyphHeight = component.y1 - component.y0;
    const glyphWidth = component.x1 - component.x0;
    const parts =
      glyphWidth <= MERGED_WIDTH_RATIO * glyphHeight ? 1 : Math.max(1, Math.round(glyphWidth / (DIGIT_ASPECT * glyphHeight)));
    const step = glyphWidth / parts;
    for (let part = 0; part < parts; part++) {
      const fromX = component.x0 + Math.floor(part * step);
      const toX = component.x0 + Math.floor((part + 1) * step);
      text += classifyDigit(toGlyphBits(component, label.width, fromX, toX));
    }
  }

  if (text.length < MIN_DIGITS || text.length > MAX_DIGITS) return null;
  const number = Number(text);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/** アイコンの平均の明るさ（0〜1）。未所持で暗く表示されたアイコンの見分けに使う */
export function averageBrightness(image: RgbaImage): number {
  let total = 0;
  const pixelCount = image.width * image.height;
  for (let index = 0; index < pixelCount; index++) {
    const offset = index * 4;
    // 人の目の感じ方に合わせた重み（ITU-R BT.601）
    total += 0.299 * image.data[offset] + 0.587 * image.data[offset + 1] + 0.114 * image.data[offset + 2];
  }
  return pixelCount === 0 ? 0 : total / pixelCount / 255;
}
