export const osc = (...seq: any[]) => `\x1b]${seq.join(';')}\x07`;

export const csi = (...seq: any[]) => `\x1b[${seq.join('')}`;

export const sgr = (...codes: (number | string)[]) => csi(`${codes.join(';')}m`);

export const bold = (text: string) => sgr(1) + text + sgr(22);

export const dim = (text: string) => sgr(2) + text + sgr(22);

export const italic = (text: string) => sgr(3) + text + sgr(23);

export const underline = (text: string) => sgr(4) + text + sgr(24);

export const inverse = (text: string) => sgr(7) + text + sgr(27);

export const strikeThrough = (text: string) => sgr(9) + text + sgr(29);

export const fg = (color: number | string, text: string) => sgr(color) + text + sgr(39);

export const bg = (color: number | string, text: string) => sgr(color) + text + sgr(49);

export const sgrReset = sgr(0);

export const cursorHome = csi('H');

export const cursorTo = (line: number, column: number) => csi(line + 1, ';', column + 1, 'H');

export const cursorColumn = (column: number) => csi(column + 1, 'G');

export const cursorUp = (n = 0) => csi(n || '', 'A');

export const cursorDown = (n = 0) => csi(n || '', 'B');

export const cursorForward = (n = 0) => csi(n || '', 'C');

export const cursorBackward = (n = 0) => csi(n || '', 'D');

export const cursorLineDown = (n = 0) => csi(n || '', 'E');

export const cursorLineUp = (n = 0) => csi(n || '', 'F');

export const eraseDown = csi('J'); // 0J

export const eraseUp = csi('1J');

export const eraseScreen = csi('2J');

export const eraseLineEnd = csi('K'); // 0K

export const eraseLineStart = csi('1K');

export const eraseLine = csi('2K');

export const showCursor = csi('?25h');

export const hideCursor = csi('?25l');

export const enableAlternateBuffer = csi('?1049h');

export const disableAlternateBuffer = csi('?1049l');