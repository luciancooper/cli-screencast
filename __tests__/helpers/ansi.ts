import type { RGBA } from '@src/types';

export const link = (text: string, url: string) => `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;

export const esc = (...seq: any[]) => `\x1b[${seq.join('')}`;

export const sgr = (...codes: (number | string)[]) => esc(`${codes.join(';')}m`);

export const bold = (text: string) => sgr(1) + text + sgr(22);

export const dim = (text: string) => sgr(2) + text + sgr(22);

export const italic = (text: string) => sgr(3) + text + sgr(23);

export const underline = (text: string) => sgr(4) + text + sgr(24);

export const inverse = (text: string) => sgr(7) + text + sgr(27);

export const strikeThrough = (text: string) => sgr(9) + text + sgr(29);

export const fg = (color: number, text: string) => sgr(color) + text + sgr(39);

export const bg = (color: number, text: string) => sgr(color) + text + sgr(49);

export const fg8Bit = (color: number, text: string) => sgr(38, 5, color) + text + sgr(39);

export const bg8Bit = (color: number, text: string) => sgr(48, 5, color) + text + sgr(49);

export const fgRGB = ([r, g, b]: RGBA, text: string) => sgr(38, 2, r, g, b) + text + sgr(39);

export const bgRGB = ([r, g, b]: RGBA, text: string) => sgr(48, 2, r, g, b) + text + sgr(49);

export const sgrReset = sgr(0);

export const cursorHome = esc('H');

export const cursorTo = (line: number, column: number) => esc(line + 1, ';', column + 1, 'H');

export const cursorColumn = (column: number) => esc(column + 1, 'G');

export const cursorUp = (n = 0) => esc(n || '', 'A');

export const cursorDown = (n = 0) => esc(n || '', 'B');

export const cursorForward = (n = 0) => esc(n || '', 'C');

export const cursorBackward = (n = 0) => esc(n || '', 'D');

export const cursorLineDown = (n = 0) => esc(n || '', 'E');

export const cursorLineUp = (n = 0) => esc(n || '', 'F');

export const eraseDown = esc('J'); // 0J

export const eraseUp = esc('1J');

export const eraseScreen = esc('2J');

export const eraseLineEnd = esc('K'); // 0K

export const eraseLineStart = esc('1K');

export const eraseLine = esc('2K');

export const showCursor = esc('?25h');

export const hideCursor = esc('?25l');

export const enableAlternateBuffer = esc('?1049h');

export const disableAlternateBuffer = esc('?1049l');