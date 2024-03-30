import type { FontStyle, Os2Table, HeadTable } from './types';
import type { AnsiCode } from './content';

interface KeywordRegExp<T> {
    family: RegExp
    subfamily: RegExp
    value: T
}

function keywordRegExpArray<T>(kw: [T, string][]) {
    return kw.map(([value, re]) => ({
        family: new RegExp(` ${re}`, 'i'),
        subfamily: new RegExp(` ?${re}`, 'i'),
        value,
    }));
}

type FontWeight = FontStyle['weight'];

const fontWeights: FontWeight[] = [100, 200, 300, 350, 400, 450, 500, 600, 700, 800, 900, 950];

const fontWeightKeywords = keywordRegExpArray<FontWeight>([
    [100, 'thin'],
    [200, '(?:extra|ultra)[ -]?light'],
    [350, 'semi[ -]?light'],
    [300, 'light'],
    [500, 'medium'],
    [600, '(?:demi[ -]?bold|semi[ -]?bold|demi)'],
    [800, '(?:extra|ultra)[ -]?bold'],
    [950, '(?:extra|ultra)[ -]?black'],
    [700, 'bold'],
    [900, '(?:black|heavy)'],
    [450, 'retina'],
    // [400, '(?:regular|normal)'],
]);

type FontWidth = FontStyle['width'];

const fontWidths: FontWidth[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const fontWidthKeywords = keywordRegExpArray<FontWidth>([
    [1, 'ultra[ -]?(?:condensed|cond)'],
    [2, '(?:extra|ext)[ -]?(?:condensed|cond)'],
    [4, 'semi[ -]?(?:condensed|cond)'],
    [3, '(?:condensed|cond|narrow)'],
    [6, 'semi[ -]?expanded'],
    [8, '(?:extra|ext)[ -]?expanded'],
    [9, 'ultra[ -]?expanded'],
    [7, 'expanded'],
]);

function findClosestNormalizedValue<T extends number>(values: T[], value: number, def: T): number {
    // return closest standard value
    let idx = 0;
    for (; idx < values.length; idx += 1) {
        if (value === values[idx]) {
            return idx;
        }
        if (value < values[idx]!) break;
    }
    // get two closest normalized values
    const [v1, v2] = [values[idx - 1], values[idx]];
    // return the index of the closer of the two normalized values
    return (v1 === undefined) ? idx : (v2 === undefined) ? idx - 1
        : (value - v1 < v2 - value) ? idx - 1
            : (value - v1 > v2 - value) ? idx
                : value > def ? idx - 1 : idx;
}

const coreTextWeightThresholds: [number, FontWeight][] = [
    [-0.8, 100], [-0.5, 200], [-0.4, 300], [0, 400],
    [0.25, 500], [0.35, 600], [0.5, 700], [0.6, 800],
];

/**
 * converts a CoreText weight (-1 to +1) to a standard weight (100 to 900)
 * source: https://github.com/foliojs/font-manager/blob/master/src/FontManagerMac.mm#L6
 */
function coreTextWeight(value: number): FontWeight {
    for (const [threshold, weight] of coreTextWeightThresholds) {
        if (value <= threshold) return weight;
    }
    return 900;
}

/**
 * converts a CoreText width (-1 to +1) to a standard width (1 to 9)
 * source: https://github.com/foliojs/font-manager/blob/master/src/FontManagerMac.mm#L27
 */
function coreTextWidth(width: number): FontWidth {
    return (width < 0 ? (1 + Math.round((1 + width) * 4)) : (5 + Math.round(width * 4))) as FontWidth;
}

function extractKeywordValue<T>(
    family: string,
    subfamily: string,
    regexs: KeywordRegExp<T>[],
): [string, string, T | null] {
    if (family) {
        for (const { family: re, value } of regexs) {
            if (re.test(family)) return [family.replace(re, ''), subfamily, value];
        }
    }
    for (const { subfamily: re, value } of regexs) {
        if (re.test(subfamily)) return [family, subfamily.replace(re, ''), value];
    }
    return [family, subfamily, null];
}

export function getFontStyle(
    names: Record<number, string>,
    os2: Os2Table | null,
    head: HeadTable | null,
): { family: string, style: FontStyle } {
    let family = names[16] ?? names[1]!,
        subfamily = names[17] ?? names[2]!;
    // do not use wss names if OS/2 table version is >= 4 & fsSelection bit 8 is set
    if (!(os2 && os2.version >= 4 && (os2.fsSelection & 0b100000000))) {
        family = names[21] ?? family;
        subfamily = names[22] ?? subfamily;
    }
    // extract weight keyword from family name / subfamily name
    let namedWeight: FontWeight | null = null;
    [family, subfamily, namedWeight] = extractKeywordValue(family, subfamily, fontWeightKeywords);
    // determine font weight
    let weight: FontWeight;
    if (namedWeight == null) {
        // determine weight from OS/2 usWeightClass value
        weight = !os2 ? 400 : os2.usWeightClass <= 1 ? coreTextWeight(os2.usWeightClass)
            : (os2.usWeightClass >= 50 && os2.usWeightClass <= 1000)
                ? fontWeights[findClosestNormalizedValue(fontWeights, os2.usWeightClass, 400)]! : 400;
        // set regular weights to bold if OS/2 fsSelection bit 5 is set or head macStyle bit 1 is set
        if (weight === 400 && (!!(os2 && os2.fsSelection & 0b0100000) || !!(head && head.macStyle & 0b0000001))) {
            weight = 700;
        }
    } else weight = namedWeight;
    // extract width keyword from family name / subfamily name
    let namedWidth: FontWidth | null = null;
    [family, subfamily, namedWidth] = extractKeywordValue(family, subfamily, fontWidthKeywords);
    // determine font width
    let width: FontWidth;
    if (namedWidth == null) {
        // extract width from OS/2 usWidthClass value
        width = !os2 ? 5 : os2.usWidthClass < 1 ? coreTextWidth(os2.usWidthClass)
            : fontWidths[findClosestNormalizedValue(fontWidths, os2.usWidthClass, 5)]!;
        // set regular widths to condensed if 'head' table macStyle bit 5 is set
        if (width === 5 && (head && head.macStyle & 0b0100000)) {
            width = 3;
        }
    } else width = namedWidth;
    // get oblique status from OS/2 fsSelection bit 9 if OS/2 table version is 4 or 5
    let oblique = (os2 && os2.version >= 4) ? !!(os2.fsSelection & 0b1000000000) : false;
    // extract oblique keyword from family / subfamily name
    if (/ oblique/i.test(family)) {
        [family, oblique] = [family.replace(/ oblique/i, ''), true];
    } else if (/oblique/i.test(subfamily)) {
        [subfamily, oblique] = [subfamily.replace(/ ?oblique/i, ''), true];
    }
    // determine italic status from OS/2 fsSelection bit 1 or head macStyle bit 2
    let italic = !!(os2 && os2.fsSelection & 0b0000001) || !!(head && head.macStyle & 0b0000010);
    // extract italic keyword from family / subfamily name
    if (/ italic/i.test(family)) {
        [family, italic] = [family.replace(/ italic/i, ''), true];
    } else if (/italic/i.test(subfamily)) {
        [subfamily, italic] = [subfamily.replace(/ ?italic/i, ''), true];
    }
    if (oblique) italic = false;
    // determine slant
    const slant = oblique ? 1 : italic ? 2 : 0;
    // return font attributes
    return { family, style: { weight, width, slant } };
}

const wdthPctOfNormal = [50, 62.5, 75, 87.5, 100, 112.5, 125, 150, 200];

export function extendFontStyle(
    style: FontStyle,
    axes: Record<string, { min: number, def: number, max: number }>,
    subfamily: string,
    instance: Record<string, number>,
): FontStyle {
    let { weight, width, slant } = style;
    // check for italic / oblique keywords
    if (/italic/i.test(subfamily)) {
        slant = 2;
    } else if (/oblique/i.test(subfamily)) {
        slant = 1;
    }
    // update weight
    const [,, namedWeight] = extractKeywordValue('', subfamily, fontWeightKeywords);
    if ('wght' in instance && axes['wght']!.min >= 50 && axes['wght']!.max <= 1000) {
        weight = fontWeights[findClosestNormalizedValue(fontWeights, instance['wght'], 400)]!;
    } else if (namedWeight) {
        weight = namedWeight;
    }
    // update width
    const [,, namedWidth] = extractKeywordValue('', subfamily, fontWidthKeywords);
    if ('wdth' in instance) {
        // https://learn.microsoft.com/en-us/typography/opentype/spec/os2#uswidthclass
        // https://learn.microsoft.com/en-us/typography/opentype/spec/dvaraxistag_wdth#additional-information
        const pctOfNormal = (instance['wdth'] / axes['wdth']!.def) * 100;
        width = fontWidths[findClosestNormalizedValue(wdthPctOfNormal, pctOfNormal, 100)]!;
    } else if (namedWidth) {
        width = namedWidth;
    }
    // return updated style
    return { weight, width, slant };
}

const fontWeightMatchPriority: [FontWeight[], FontWeight[]] = [
    // weights sorted by increasing proximity to the default normal weight 400
    [950, 900, 800, 700, 600, 100, 500, 200, 300, 350, 450, 400],
    // weights sorted by increasing proximity to the default bold weight 700
    [100, 200, 300, 350, 400, 450, 500, 950, 900, 600, 800, 700],
];

// font widths sorted by increasing proximity to the default width 5
const fontWidthMatchPriority: FontWidth[] = [9, 1, 8, 2, 7, 3, 6, 4, 5];

/**
 * Sorts font styles based on their proximity to a given ansi style.
 * A numerical value is created for each font style:
 * bytes 0 - 3 indicate proximity to the width to 5
 * bytes 4 - 7 indicate proximity of the weight to either 400 or 700 depending on the ansi code
 * bytes 8 - 9 indicate proximity of the slant to normal or italic depending on the ansi code
 */
export function styleAnsiMatchPriority(
    fonts: { style: FontStyle, fvarInstance?: { defscore: number } }[],
    ansi: AnsiCode,
): number[] {
    return fonts.map<[number, number, number]>(({ style: { slant, weight, width }, fvarInstance }, idx) => [
        idx,
        (((ansi & 0b10) ? slant : 2 - slant) << 8)
        | (fontWeightMatchPriority[ansi & 1]!.indexOf(weight) << 4)
        | fontWidthMatchPriority.indexOf(width),
        fvarInstance?.defscore ?? 0,
    ]).sort(([i1, p1, def1], [i2, p2, def2]) => (
        (p2 - p1) || (def2 - def1) || (i1 - i2)
    )).map(([idx]) => idx);
}