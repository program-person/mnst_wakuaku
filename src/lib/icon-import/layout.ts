/**
 * ゲーム内「モンスター図鑑」画面のマス目の位置。
 * 画面の横幅に対する比率で持つので、同じ縦横比の端末なら解像度が違っても合う。
 * 基準は横 963 の表示で測った値（実画像 1440×2992 のスクショ2枚で位置合わせ済み）。
 */

const REFERENCE_WIDTH = 963;
const FIRST_LEFT = 55;
const FIRST_TOP = 553;
const CELL_WIDTH = 142;
const CELL_HEIGHT = 155;
const COLUMN_PITCH = 175;
const ROW_PITCH = 171.7;
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 7;

/** アイコンとして保存する範囲は、図鑑No のラベルより上（カードの上から 78%） */
const ICON_HEIGHT_RATIO = 0.78;
/** ラベル帯。4桁の番号は枠からはみ出すので、左右に広げる（隣のラベルとは重ならない幅） */
const LABEL_TOP_RATIO = 0.78;
const LABEL_BOTTOM_RATIO = 1.02;
const LABEL_LEFT_MARGIN = 10;
const LABEL_RIGHT_EXTENT = 160;

export type Box = { x: number; y: number; width: number; height: number };

export type GridCell = {
  row: number;
  column: number;
  /** 保存するアイコンの範囲 */
  icon: Box;
  /** 図鑑No を読む範囲 */
  label: Box;
};

function roundBox(x: number, y: number, width: number, height: number): Box {
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** 画像の中に収まるマスだけを返す（下端がはみ出す段は除く） */
export function gridCells(imageWidth: number, imageHeight: number): GridCell[] {
  const scale = imageWidth / REFERENCE_WIDTH;
  const cells: GridCell[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let column = 0; column < GRID_COLUMNS; column++) {
      const left = (FIRST_LEFT + column * COLUMN_PITCH) * scale;
      const top = (FIRST_TOP + row * ROW_PITCH) * scale;
      const cellWidth = CELL_WIDTH * scale;
      const cellHeight = CELL_HEIGHT * scale;

      const labelLeft = Math.max(0, left - LABEL_LEFT_MARGIN * scale);
      const labelRight = Math.min(imageWidth, left + LABEL_RIGHT_EXTENT * scale);
      const labelTop = top + cellHeight * LABEL_TOP_RATIO;
      const labelBottom = top + cellHeight * LABEL_BOTTOM_RATIO;
      if (labelBottom > imageHeight) continue;

      cells.push({
        row,
        column,
        icon: roundBox(left, top, cellWidth, cellHeight * ICON_HEIGHT_RATIO),
        label: roundBox(labelLeft, labelTop, labelRight - labelLeft, labelBottom - labelTop),
      });
    }
  }
  return cells;
}
