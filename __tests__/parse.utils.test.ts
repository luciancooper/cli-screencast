import type { TerminalLine, TextLine } from '@src/types';
import { cursorLinePartial, overwriteLine, clearLineBefore, clearLineAfter } from '@src/parse';
import { makeLine, makeCursor } from './helpers/objects';

describe('cursorLinePartial', () => {
    const lines: TerminalLine[] = [
        { index: 0, ...makeLine('aaaaa', ['bbbbb', { bold: true }], 'ccccc') },
        { index: 1, ...makeLine(['dddddddddd', { dim: true }], 'ee') },
    ];

    test('returns an empty line if cursor line index exceeds line array length', () => {
        expect(cursorLinePartial({ lines, cursor: makeCursor(2, 8) }))
            .toEqual<TerminalLine>({ index: 0, ...makeLine(8) });
    });

    test('only adjusts cursor line column value if cursor column exceeds its width', () => {
        expect(cursorLinePartial({ lines, cursor: makeCursor(1, 14) }))
            .toEqual<TerminalLine>({ index: 0, ...makeLine(['dddddddddd', { dim: true }], 'ee', 2) });
    });

    test('slices line content up to the cursor column index', () => {
        expect(cursorLinePartial({ lines, cursor: makeCursor(0, 8) }))
            .toEqual<TerminalLine>({ index: 0, ...makeLine('aaaaa', ['bbb', { bold: true }]) });
        expect(cursorLinePartial({ lines, cursor: makeCursor(0, 5) }))
            .toEqual<TerminalLine>({ index: 0, ...makeLine('aaaaa') });
    });
});

describe('overwriteLine', () => {
    test('returns overwriting line if it is wider than the line being overwritten', () => {
        const prev = makeLine('aaaaa'),
            next = makeLine('bbbbbbbbbb');
        expect(overwriteLine(prev, next)).toEqual(next);
    });

    test('appends the end of the overwritten line to the overwriting line when it is wider', () => {
        const prev = makeLine('aaaaa', ['bbbbb', { bold: true }]),
            next = makeLine('xxxxxxxx');
        expect(overwriteLine(prev, next)).toEqual<TextLine>(makeLine('xxxxxxxx', ['bb', { bold: true }]));
    });

    test('handles half-width characters partially overwriting full-width characters', () => {
        const prev = makeLine('ａａ', ['ｂｂ', { bold: true }]);
        expect(overwriteLine(prev, makeLine('aaa')))
            .toEqual<TextLine>(makeLine('aaa', 1, ['ｂｂ', { bold: true }]));
        expect(overwriteLine(prev, makeLine('aaaa', ['b', { bold: true }])))
            .toEqual<TextLine>(makeLine('aaaa', ['b', { bold: true }], 1, ['ｂ', { bold: true }]));
    });
});

describe('clearLineBefore', () => {
    test('clears line content before the column index', () => {
        const line = makeLine('aaaaa', ['bbbbb', { bold: true }], 'ccc');
        expect(clearLineBefore(line, 9)).toEqual<TextLine>(makeLine(9, ['b', { bold: true }], 'ccc'));
    });

    test('clears entire line if column position exceeds the line width', () => {
        const line = makeLine('xxxxxxxx');
        expect(clearLineBefore(line, 9)).toEqual<TextLine>(makeLine());
    });

    test('clears full-width characters that span the column index', () => {
        const line = makeLine('ａａａ', ['ｂｂｂ', { bold: true }], 'ｃｃｃ');
        // column index is in the middle of the third 'ｂ'
        expect(clearLineBefore(line, 11)).toEqual<TextLine>(makeLine(12, 'ｃｃｃ'));
        // column index is in the middle of the last 'ｃ'
        expect(clearLineBefore(line, 17)).toEqual<TextLine>(makeLine());
    });
});

describe('clearLineAfter', () => {
    test('clears line content after the column index', () => {
        const line = makeLine('aaaaa', ['bbbbb', { bold: true }], 'ccc');
        expect(clearLineAfter(line, 0)).toEqual<TextLine>(makeLine());
        expect(clearLineAfter(line, 9)).toEqual<TextLine>(makeLine('aaaaa', ['bbbb', { bold: true }]));
    });

    test('clears nothing if column position exceeds the line width', () => {
        const line = makeLine('xxxxxxxx');
        expect(clearLineAfter(line, 9)).toEqual<TextLine>(line);
    });

    test('clears full-width characters that span the column index', () => {
        const line = makeLine('ａａａ', ['ｂｂｂ', { bold: true }], 'ｃｃｃ');
        // column index is in the middle of the first 'ａ'
        expect(clearLineAfter(line, 1)).toEqual<TextLine>(makeLine());
    });
});