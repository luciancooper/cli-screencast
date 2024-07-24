import type { CodePointRange } from './range';

export interface FontStyle {
    /**
     * Font style weight values:
     * - `100` → 'Thin'
     * - `200` → 'Extra Light', 'Ultra Light'
     * - `300` → 'Light'
     * - `350` → 'Semi Light'
     * - `400` → 'Regular'
     * - `450` → 'Retina'
     * - `500` → 'Medium'
     * - `600` → 'Demi Bold', 'Semi Bold', 'Demi'
     * - `700` → 'Bold'
     * - `800` → 'Extra Bold', 'Ultra Bold'
     * - `900` → 'Black', 'Heavy'
     * - `950` → 'Extra Black', 'Ultra Black'
     */
    weight: 100 | 200 | 300 | 350 | 400 | 450 | 500 | 600 | 700 | 800 | 900 | 950

    /**
     * Font style width values:
     * - `1` → 'Ultra Condensed'
     * - `2` → 'Extra Condensed'
     * - `3` → 'Condensed'
     * - `4` → 'Semi Condensed'
     * - `5` → 'Medium' (normal)
     * - `6` → Semi Expanded
     * - `7` → 'Expanded'
     * - `8` → 'Extra Expanded'
     * - `9` → 'Ultra Expanded'
     */
    width: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

    /**
     * Font style slant value
     * - `0` → Regular
     * - `1` → Oblique
     * - `2` → Italic
     */
    slant: 0 | 1 | 2
}

/**
 * Opentype font header and table directory
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/otff#table-directory}
 */
export interface SfntHeader {
    signature: number
    numTables: number
    searchRange: number
    entrySelector: number
    rangeShift: number
    tables: {
        tag: number
        checksum: number
        offset: number
        bytes: number
    }[]
}

/**
 * Information about a single font style
 */
export interface FontData {
    family: string
    style: FontStyle
    coverage: CodePointRange
    fvarInstance?: { coords: Record<string, number>, defscore: number }
    ttcSubfont?: SfntHeader
}

/**
 * Information about a single system font style
 */
export interface SystemFont extends FontData {
    filePath: string
}

export interface SystemFontData {
    filePath: string
    style: 'italic' | 'normal'
    weight: FontStyle['weight']
    fvar?: [string, number][]
    ttcSubfont?: SfntHeader
}

export type ResolvedFontFamily = { name: string } & ({
    type: 'system'
    fonts: { data: SystemFontData, chars: string }[]
} | {
    type: 'google'
    fonts: { params: string, chars: string }[]
} | {
    type: 'generic' | null
});

/**
 * Font 'name' table record
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/name}
 */
export interface NameRecord {
    platformID: number
    languageID: number
    encodingID: number
    nameID: number
    string: string
    encoding: string
    lang: string
}

/**
 * Font 'OS/2' table data
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/os2}
 */
export interface Os2Table {
    version: number
    usWeightClass: number
    usWidthClass: number
    fsSelection: number
}

/**
 * Font 'head' table data
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/head}
 */
export interface HeadTable {
    unitsPerEm: number
    macStyle: number
}

/**
 * Font 'maxp' table data
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/maxp}
 */
export interface MaxpTable {
    numGlyphs: number
}

/**
 * Font 'fvar' table data
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/fvar}
 */
export interface FvarTable {
    /**
     * font variation axis records
     * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/fvar#variationaxisrecord}
     */
    axes: {
        tag: string
        min: number
        def: number
        max: number
        flags: number
        nameID: number
    }[]
    /**
     * font variation instance records
     * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/fvar#instancerecord}
     */
    instances: {
        sfNameID: number
        coordsArray: number[]
        psNameID: number | null
    }[]
}

/**
 * Font 'cmap' table data
 * @see {@link https://learn.microsoft.com/en-us/typography/opentype/spec/cmap}
 */
export type CmapTable = (({
    format: 0
    glyphIdArray: number[]
} | {
    format: 2
    subHeaderKeys: number[]
    subHeaderCount: number
    subHeaders: {
        firstCode: number
        entryCount: number
        idDelta: number
        idRangeOffset: number
    }[]
    glyphIdArray: number[]
} | {
    format: 4
    segCount: number
    endCodes: number[]
    startCodes: number[]
    idDeltas: number[]
    idRangeOffsets: number[]
    glyphIdArray: number[]
} | {
    format: 6 | 10
    startCharCode: number
    numChars: number
    glyphIdArray: number[]
} | (({
    format: 8
    is32: number[]
} | { format: 12 | 13 }) & {
    groups: {
        startCharCode: number
        endCharCode: number
        glyphID: number
    }[]
})) | {
    format: 14
    varSelectors: number[]
}) & { language: number };