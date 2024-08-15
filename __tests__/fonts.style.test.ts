import { getFontStyle, extendFontStyle, styleAnsiMatchPriority } from '@src/fonts/style';

enum FsSelection {
    italic = 1, // bit 1
    bold = 32, // bit 5
    wss = 256, // bit 8
    oblique = 512, // bit 9
}

function os2(usWeightClass: number, usWidthClass: number, version: number, ...fsSelection: FsSelection[]) {
    return {
        version,
        usWeightClass,
        usWidthClass,
        fsSelection: fsSelection.reduce((mask, bit) => mask | bit, 0),
    };
}

enum MacStyle {
    bold = 1, // bit 1
    italic = 2, // bit 2
    condensed = 32, // bit 5
}

function head(...macStyle: MacStyle[]) {
    return {
        macStyle: macStyle.reduce((mask, bit) => mask | bit, 0),
    };
}

describe('getFontStyle', () => {
    test('uses typographic family name when present', () => {
        expect(getFontStyle({
            1: 'Family',
            2: 'Subfamily',
            16: 'Typographic Family',
            17: 'Typographic Subfamily',
        }, os2(400, 5, 1), head())).toEqual({
            family: 'Typographic Family',
            style: { weight: 400, width: 5, slant: 0 },
        });
    });

    test('uses wss family name when present', () => {
        expect(getFontStyle({
            1: 'Family',
            2: 'Subfamily',
            16: 'Typographic Family',
            17: 'Typographic Subfamily',
            21: 'WSS Family',
            22: 'WSS Subfamily',
        }, os2(400, 5, 1), head())).toEqual({
            family: 'WSS Family',
            style: { weight: 400, width: 5, slant: 0 },
        });
    });

    test('does not use wss family name when fsSelection bit 8 is set', () => {
        expect(getFontStyle({
            1: 'Family',
            2: 'Subfamily',
            16: 'Typographic Family',
            17: 'Typographic Subfamily',
            21: 'WSS Family',
            22: 'WSS Subfamily',
        }, os2(400, 5, 4, FsSelection.wss), head())).toEqual({
            family: 'Typographic Family',
            style: { weight: 400, width: 5, slant: 0 },
        });
    });

    test('extract weight & width keywords from family name', () => {
        expect(getFontStyle({ 1: 'Gill Sans Ultra Bold Condensed', 2: 'Regular' }, os2(400, 5, 1), head()))
            .toEqual({ family: 'Gill Sans', style: { weight: 800, width: 3, slant: 0 } });
    });

    test('extract slant keywords from family names', () => {
        expect(getFontStyle({ 1: 'Arial Oblique', 2: 'Regular' }, os2(400, 5, 1), head()))
            .toEqual({ family: 'Arial', style: { weight: 400, width: 5, slant: 1 } });
        expect(getFontStyle({ 1: 'Arial Italic', 2: 'Regular' }, os2(400, 5, 1), head()))
            .toEqual({ family: 'Arial', style: { weight: 400, width: 5, slant: 2 } });
    });

    test('identify weight & width keywords in subfamily names', () => {
        expect(getFontStyle({ 1: 'Arial', 2: 'Bold' }, os2(400, 5, 1), head()))
            .toEqual({ family: 'Arial', style: { weight: 700, width: 5, slant: 0 } });
        expect(getFontStyle({ 1: 'Arial', 2: 'Narrow' }, os2(400, 5, 1), head()))
            .toEqual({ family: 'Arial', style: { weight: 400, width: 3, slant: 0 } });
    });

    test('identify slant keywords in subfamily names', () => {
        expect(getFontStyle({ 1: 'Avenir', 2: 'Oblique' }, os2(400, 5, 3, FsSelection.italic), head()))
            .toEqual({ family: 'Avenir', style: { weight: 400, width: 5, slant: 1 } });
        expect(getFontStyle({ 1: 'Avenir Next', 2: 'Italic' }, os2(400, 5, 3, FsSelection.italic), head()))
            .toEqual({ family: 'Avenir Next', style: { weight: 400, width: 5, slant: 2 } });
    });

    test('normalize irregular os2.usWeightClass values', () => {
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(50, 5, 2), head()))
            .toEqual({ family: 'Arial', style: { weight: 100, width: 5, slant: 0 } });
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(225, 5, 2), head()))
            .toEqual({ family: 'Arial', style: { weight: 200, width: 5, slant: 0 } });
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(250, 5, 2), head()))
            .toEqual({ family: 'Arial', style: { weight: 300, width: 5, slant: 0 } });
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(550, 5, 2), head()))
            .toEqual({ family: 'Arial', style: { weight: 500, width: 5, slant: 0 } });
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(575, 5, 2), head()))
            .toEqual({ family: 'Arial', style: { weight: 600, width: 5, slant: 0 } });
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(1000, 5, 2), head()))
            .toEqual({ family: 'Arial', style: { weight: 950, width: 5, slant: 0 } });
    });

    test('assumes default weight for extremely irregular os2.usWeightClass values', () => {
        expect(getFontStyle({ 1: 'Skia', 2: 'Regular' }, os2(5, 5, 1), head()))
            .toEqual({ family: 'Skia', style: { weight: 400, width: 5, slant: 0 } });
    });

    test('assumes default weight & width when OS/2 table is not present', () => {
        expect(getFontStyle({ 1: 'AppleGothic', 2: 'Regular' }, null, head()))
            .toEqual({ family: 'AppleGothic', style: { weight: 400, width: 5, slant: 0 } });
    });

    test('use bit 5 of the OS/2 table fsSelection flags to detect bold fonts', () => {
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(400, 5, 1, FsSelection.bold), head()))
            .toEqual({ family: 'Arial', style: { weight: 700, width: 5, slant: 0 } });
    });

    test('use bit 1 of the head table macStyle detect bold fonts', () => {
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(400, 5, 1), head(MacStyle.bold)))
            .toEqual({ family: 'Arial', style: { weight: 700, width: 5, slant: 0 } });
    });

    test('use bit 2 of the head table macStyle detect condensed fonts', () => {
        expect(getFontStyle({ 1: 'Arial', 2: 'Regular' }, os2(400, 5, 1), head(MacStyle.condensed)))
            .toEqual({ family: 'Arial', style: { weight: 400, width: 3, slant: 0 } });
    });

    test('normalize core text weight values', () => {
        expect(getFontStyle({ 1: 'Apple Chancery', 2: 'Chancery' }, os2(0, 5, 4), head()))
            .toEqual({ family: 'Apple Chancery', style: { weight: 400, width: 5, slant: 0 } });
    });

    test('normalize core text width values', () => {
        expect(getFontStyle({ 1: 'Apple Chancery', 2: 'Chancery' }, os2(400, -0.5, 4), head()))
            .toEqual({ family: 'Apple Chancery', style: { weight: 400, width: 3, slant: 0 } });
        expect(getFontStyle({ 1: 'Apple Chancery', 2: 'Chancery' }, os2(400, 0.5, 4), head()))
            .toEqual({ family: 'Apple Chancery', style: { weight: 400, width: 7, slant: 0 } });
    });
});

describe('extendFontStyle', () => {
    test('identifies slant from subfamily name', () => {
        expect(extendFontStyle(
            { weight: 400, width: 5, slant: 0 },
            { wght: { min: 100, def: 400, max: 900 } },
            'Italic',
            { wght: 400 },
        )).toEqual({ weight: 400, width: 5, slant: 2 });
        expect(extendFontStyle(
            { weight: 400, width: 5, slant: 0 },
            { wght: { min: 100, def: 400, max: 900 } },
            'Oblique',
            { wght: 400 },
        )).toEqual({ weight: 400, width: 5, slant: 1 });
    });

    test('maps wdth axis values to a width value between 1 - 9', () => {
        // 100% of normal
        expect(extendFontStyle(
            { weight: 400, width: 5, slant: 0 },
            { wdth: { min: 75, def: 100, max: 100 } },
            'Regular',
            { wdth: 100 },
        )).toEqual({ weight: 400, width: 5, slant: 0 });
        // 87.5% of normal
        expect(extendFontStyle(
            { weight: 400, width: 5, slant: 0 },
            { wdth: { min: 75, def: 100, max: 100 } },
            'Regular',
            { wdth: 87.5 },
        )).toEqual({ weight: 400, width: 4, slant: 0 });
    });

    test('identify named weights if wght axis is irregular', () => {
        // taken from Skia.ttf
        expect(extendFontStyle(
            { weight: 400, width: 5, slant: 0 },
            { wght: { min: 0.48, def: 1, max: 3.2 }, wdth: { min: 0.62, def: 1, max: 1.3 } },
            'Bold',
            { wght: 1.95, wdth: 1 },
        )).toEqual({ weight: 700, width: 5, slant: 0 });
    });
});

describe('styleAnsiMatchPriority', () => {
    const styles: Parameters<typeof styleAnsiMatchPriority>[0] = [
        { style: { weight: 300, width: 3, slant: 0 } },
        { style: { weight: 400, width: 3, slant: 0 } },
        { style: { weight: 700, width: 3, slant: 0 } },
        { style: { weight: 400, width: 5, slant: 0 } },
        { style: { weight: 700, width: 5, slant: 0 } },
        { style: { weight: 900, width: 5, slant: 0 } },
        { style: { weight: 300, width: 5, slant: 1 } },
        { style: { weight: 800, width: 5, slant: 1 } },
        { style: { weight: 400, width: 3, slant: 2 } },
        { style: { weight: 700, width: 3, slant: 2 } },
        { style: { weight: 400, width: 5, slant: 2 } },
        { style: { weight: 700, width: 5, slant: 2 } },
        { style: { weight: 900, width: 5, slant: 2 } },
    ];

    test('normal style proximity', () => {
        expect(styleAnsiMatchPriority(styles, 0).map((idx) => styles[idx]!)).toEqual([
            { style: { weight: 400, width: 5, slant: 0 } },
            { style: { weight: 400, width: 3, slant: 0 } },
            { style: { weight: 300, width: 3, slant: 0 } },
            { style: { weight: 700, width: 5, slant: 0 } },
            { style: { weight: 700, width: 3, slant: 0 } },
            { style: { weight: 900, width: 5, slant: 0 } },
            { style: { weight: 300, width: 5, slant: 1 } },
            { style: { weight: 800, width: 5, slant: 1 } },
            { style: { weight: 400, width: 5, slant: 2 } },
            { style: { weight: 400, width: 3, slant: 2 } },
            { style: { weight: 700, width: 5, slant: 2 } },
            { style: { weight: 700, width: 3, slant: 2 } },
            { style: { weight: 900, width: 5, slant: 2 } },
        ]);
    });

    test('bold style proximity', () => {
        expect(styleAnsiMatchPriority(styles, 1).map((idx) => styles[idx]!)).toEqual([
            { style: { weight: 700, width: 5, slant: 0 } },
            { style: { weight: 700, width: 3, slant: 0 } },
            { style: { weight: 900, width: 5, slant: 0 } },
            { style: { weight: 400, width: 5, slant: 0 } },
            { style: { weight: 400, width: 3, slant: 0 } },
            { style: { weight: 300, width: 3, slant: 0 } },
            { style: { weight: 800, width: 5, slant: 1 } },
            { style: { weight: 300, width: 5, slant: 1 } },
            { style: { weight: 700, width: 5, slant: 2 } },
            { style: { weight: 700, width: 3, slant: 2 } },
            { style: { weight: 900, width: 5, slant: 2 } },
            { style: { weight: 400, width: 5, slant: 2 } },
            { style: { weight: 400, width: 3, slant: 2 } },
        ]);
    });

    test('italic style proximity', () => {
        expect(styleAnsiMatchPriority(styles, 2).map((idx) => styles[idx]!)).toEqual([
            { style: { weight: 400, width: 5, slant: 2 } },
            { style: { weight: 400, width: 3, slant: 2 } },
            { style: { weight: 700, width: 5, slant: 2 } },
            { style: { weight: 700, width: 3, slant: 2 } },
            { style: { weight: 900, width: 5, slant: 2 } },
            { style: { weight: 300, width: 5, slant: 1 } },
            { style: { weight: 800, width: 5, slant: 1 } },
            { style: { weight: 400, width: 5, slant: 0 } },
            { style: { weight: 400, width: 3, slant: 0 } },
            { style: { weight: 300, width: 3, slant: 0 } },
            { style: { weight: 700, width: 5, slant: 0 } },
            { style: { weight: 700, width: 3, slant: 0 } },
            { style: { weight: 900, width: 5, slant: 0 } },
        ]);
    });

    test('bold-italic style proximity', () => {
        expect(styleAnsiMatchPriority(styles, 3).map((idx) => styles[idx]!)).toEqual([
            { style: { weight: 700, width: 5, slant: 2 } },
            { style: { weight: 700, width: 3, slant: 2 } },
            { style: { weight: 900, width: 5, slant: 2 } },
            { style: { weight: 400, width: 5, slant: 2 } },
            { style: { weight: 400, width: 3, slant: 2 } },
            { style: { weight: 800, width: 5, slant: 1 } },
            { style: { weight: 300, width: 5, slant: 1 } },
            { style: { weight: 700, width: 5, slant: 0 } },
            { style: { weight: 700, width: 3, slant: 0 } },
            { style: { weight: 900, width: 5, slant: 0 } },
            { style: { weight: 400, width: 5, slant: 0 } },
            { style: { weight: 400, width: 3, slant: 0 } },
            { style: { weight: 300, width: 3, slant: 0 } },
        ]);
    });

    test('prioritizes specified fonts & higher defscores in the event of proximity ties', () => {
        const defscore: Parameters<typeof styleAnsiMatchPriority>[0] = [
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: false }, fvarInstance: { defscore: 0 } },
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: true }, fvarInstance: { defscore: 0 } },
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: false }, fvarInstance: { defscore: 1 } },
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: false }, fvarInstance: { defscore: 1 } },
        ];
        expect(styleAnsiMatchPriority(defscore, 0).map((idx) => defscore[idx]!)).toEqual([
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: true }, fvarInstance: { defscore: 0 } },
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: false }, fvarInstance: { defscore: 1 } },
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: false }, fvarInstance: { defscore: 1 } },
            { style: { weight: 400, width: 5, slant: 0 }, src: { specified: false }, fvarInstance: { defscore: 0 } },
        ]);
    });
});