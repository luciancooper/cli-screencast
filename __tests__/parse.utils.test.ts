import { stringWidth } from 'tty-strings';
import type { TerminalLine, TextChunk, AnsiStyle, CursorLocation } from '@src/types';
import { cursorLinePartial, overwriteLine, clearLineBefore, clearLineAfter } from '@src/parse';

const makeLine = (...instructions: (string | number)[]): TerminalLine => {
    let x = 0;
    const chunks: TextChunk[] = [];
    for (const item of instructions) {
        if (typeof item === 'string') {
            const span = stringWidth(item);
            chunks.push({ str: item, style: ({} as any) as AnsiStyle, x: [x, span] });
            x += span;
        } else x += item;
    }
    return { index: 0, columns: x, chunks };
};

const makeCursor = (line: number, column: number, hidden = false): CursorLocation => ({ line, column, hidden });

describe('cursorLinePartial', () => {
    const lines = [
        makeLine('aaaaa', 'bbbbb', 'ccccc'),
        makeLine('dddddddddd', 'ee'),
    ];

    test('returns an empty line if cursor line index exceeds line array length', () => {
        expect(cursorLinePartial({ lines, cursor: makeCursor(2, 8) }))
            .toEqual(makeLine(8));
    });

    test('only adjusts cursor line column value if cursor column exceeds its width', () => {
        expect(cursorLinePartial({ lines, cursor: makeCursor(1, 14) }))
            .toEqual(makeLine('dddddddddd', 'ee', 2));
    });

    test('slices line content up to the cursor column index', () => {
        expect(cursorLinePartial({ lines, cursor: makeCursor(0, 8) }))
            .toEqual(makeLine('aaaaa', 'bbb'));
        expect(cursorLinePartial({ lines, cursor: makeCursor(0, 5) }))
            .toEqual(makeLine('aaaaa'));
    });
});

describe('overwriteLine', () => {
    test('returns overwriting line if it is wider than the line being overwritten', () => {
        const prev = makeLine('aaaaa'),
            next = makeLine('bbbbbbbbbb');
        expect(overwriteLine(prev, next)).toEqual(next);
    });

    test('appends the end of the overwritten line to the overwriting line when it is wider', () => {
        const prev = makeLine('aaaaa', 'bbbbb'),
            next = makeLine('xxxxxxxx');
        expect(overwriteLine(prev, next)).toEqual(makeLine('xxxxxxxx', 'bb'));
    });

    test('handles half-width characters partially overwriting full-width characters', () => {
        const prev = makeLine('ａａ', 'ｂｂ');
        expect(overwriteLine(prev, makeLine('aaa'))).toEqual(makeLine('aaa', 1, 'ｂｂ'));
        expect(overwriteLine(prev, makeLine('aaaa', 'b'))).toEqual(makeLine('aaaa', 'b', 1, 'ｂ'));
    });
});

describe('clearLineBefore', () => {
    test('clears line content before the column index', () => {
        const line = makeLine('aaaaa', 'bbbbb', 'ccc');
        expect(clearLineBefore(line, 9)).toEqual(makeLine(9, 'b', 'ccc'));
    });

    test('clears entire line if column position exceeds the line width', () => {
        const line = makeLine('xxxxxxxx');
        expect(clearLineBefore(line, 9)).toEqual(makeLine());
    });

    test('clears full-width characters that span the column index', () => {
        const line = makeLine('ａａａ', 'ｂｂｂ', 'ｃｃｃ');
        // column index is in the middle of the third 'ｂ'
        expect(clearLineBefore(line, 11)).toEqual(makeLine(12, 'ｃｃｃ'));
        // column index is in the middle of the last 'ｃ'
        expect(clearLineBefore(line, 17)).toEqual(makeLine());
    });
});

describe('clearLineAfter', () => {
    test('clears line content after the column index', () => {
        const line = makeLine('aaaaa', 'bbbbb', 'ccc');
        expect(clearLineAfter(line, 0)).toEqual(makeLine());
        expect(clearLineAfter(line, 9)).toEqual(makeLine('aaaaa', 'bbbb'));
    });

    test('clears nothing if column position exceeds the line width', () => {
        const line = makeLine('xxxxxxxx');
        expect(clearLineAfter(line, 9)).toEqual(line);
    });

    test('clears full-width characters that span the column index', () => {
        const line = makeLine('ａａａ', 'ｂｂｂ', 'ｃｃｃ');
        // column index is in the middle of the first 'ａ'
        expect(clearLineAfter(line, 1)).toEqual(makeLine());
    });
});