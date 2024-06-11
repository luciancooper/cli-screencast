import type { NameRecord } from './types';

const macLanguages = [
    'en', 'fr', 'de', 'it', 'nl', 'sv', 'es', 'da', 'pt', 'no', 'he', 'ja', 'ar', 'fi', 'el', 'is', 'mt',
    'tr', 'hr', 'zh-Hant', 'ur', 'hi', 'th', 'ko', 'lt', 'pl', 'hu', 'es', 'lv', 'se', 'fo', 'fa', 'ru',
    'zh', 'nl-BE', 'ga', 'sq', 'ro', 'cz', 'sk', 'si', 'yi', 'sr', 'mk', 'bg', 'uk', 'be', 'uz', 'kk',
    'az-Cyrl', 'az-Arab', 'hy', 'ka', 'mo', 'ky', 'tg', 'tk', 'mn-CN', 'mn', 'ps', 'ks', 'ku', 'sd', 'bo',
    'ne', 'sa', 'mr', 'bn', 'as', 'gu', 'pa', 'or', 'ml', 'kn', 'ta', 'te', 'si', 'my', 'km', 'lo', 'vi',
    'id', 'tl', 'ms', 'ms-Arab', 'am', 'ti', 'om', 'so', 'sw', 'rw', 'rn', 'ny', 'mg', 'eo', , , , , ,
    , , , , , , , , , , , , , , , , , , , , , , , , , , , , 'cy', 'eu', 'ca', 'la', 'qu', 'gn', 'ay', 'tt',
    'ug', 'dz', 'jv', 'su', 'gl', 'af', 'br', 'iu', 'gd', 'gv', 'ga', 'to', 'el-polyton', 'kl', 'az', 'nn',
] as const;

const windowsLanguages = new Map<number, string>([
    [0x0436, 'af'], [0x041C, 'sq'], [0x0484, 'gsw'], [0x045E, 'am'], [0x1401, 'ar-DZ'], [0x3C01, 'ar-BH'],
    [0x0C01, 'ar'], [0x0801, 'ar-IQ'], [0x2C01, 'ar-JO'], [0x3401, 'ar-KW'], [0x3001, 'ar-LB'], [0x1001, 'ar-LY'],
    [0x1801, 'ary'], [0x2001, 'ar-OM'], [0x4001, 'ar-QA'], [0x0401, 'ar-SA'], [0x2801, 'ar-SY'], [0x1C01, 'aeb'],
    [0x3801, 'ar-AE'], [0x2401, 'ar-YE'], [0x042B, 'hy'], [0x044D, 'as'], [0x082C, 'az-Cyrl'], [0x042C, 'az'],
    [0x046D, 'ba'], [0x042D, 'eu'], [0x0423, 'be'], [0x0845, 'bn'], [0x0445, 'bn-IN'], [0x201A, 'bs-Cyrl'],
    [0x141A, 'bs'], [0x047E, 'br'], [0x0402, 'bg'], [0x0403, 'ca'], [0x0C04, 'zh-HK'], [0x1404, 'zh-MO'],
    [0x0804, 'zh'], [0x1004, 'zh-SG'], [0x0404, 'zh-TW'], [0x0483, 'co'], [0x041A, 'hr'], [0x101A, 'hr-BA'],
    [0x0405, 'cs'], [0x0406, 'da'], [0x048C, 'prs'], [0x0465, 'dv'], [0x0813, 'nl-BE'], [0x0413, 'nl'],
    [0x0C09, 'en-AU'], [0x2809, 'en-BZ'], [0x1009, 'en-CA'], [0x2409, 'en-029'], [0x4009, 'en-IN'], [0x1809, 'en-IE'],
    [0x2009, 'en-JM'], [0x4409, 'en-MY'], [0x1409, 'en-NZ'], [0x3409, 'en-PH'], [0x4809, 'en-SG'], [0x1C09, 'en-ZA'],
    [0x2C09, 'en-TT'], [0x0809, 'en-GB'], [0x0409, 'en'], [0x3009, 'en-ZW'], [0x0425, 'et'], [0x0438, 'fo'],
    [0x0464, 'fil'], [0x040B, 'fi'], [0x080C, 'fr-BE'], [0x0C0C, 'fr-CA'], [0x040C, 'fr'], [0x140C, 'fr-LU'],
    [0x180C, 'fr-MC'], [0x100C, 'fr-CH'], [0x0462, 'fy'], [0x0456, 'gl'], [0x0437, 'ka'], [0x0C07, 'de-AT'],
    [0x0407, 'de'], [0x1407, 'de-LI'], [0x1007, 'de-LU'], [0x0807, 'de-CH'], [0x0408, 'el'], [0x046F, 'kl'],
    [0x0447, 'gu'], [0x0468, 'ha'], [0x040D, 'he'], [0x0439, 'hi'], [0x040E, 'hu'], [0x040F, 'is'], [0x0470, 'ig'],
    [0x0421, 'id'], [0x045D, 'iu'], [0x085D, 'iu-Latn'], [0x083C, 'ga'], [0x0434, 'xh'], [0x0435, 'zu'], [0x0410, 'it'],
    [0x0810, 'it-CH'], [0x0411, 'ja'], [0x044B, 'kn'], [0x043F, 'kk'], [0x0453, 'km'], [0x0486, 'quc'], [0x0487, 'rw'],
    [0x0441, 'sw'], [0x0457, 'kok'], [0x0412, 'ko'], [0x0440, 'ky'], [0x0454, 'lo'], [0x0426, 'lv'], [0x0427, 'lt'],
    [0x082E, 'dsb'], [0x046E, 'lb'], [0x042F, 'mk'], [0x083E, 'ms-BN'], [0x043E, 'ms'], [0x044C, 'ml'], [0x043A, 'mt'],
    [0x0481, 'mi'], [0x047A, 'arn'], [0x044E, 'mr'], [0x047C, 'moh'], [0x0450, 'mn'], [0x0850, 'mn-CN'], [0x0461, 'ne'],
    [0x0414, 'nb'], [0x0814, 'nn'], [0x0482, 'oc'], [0x0448, 'or'], [0x0463, 'ps'], [0x0415, 'pl'], [0x0416, 'pt'],
    [0x0816, 'pt-PT'], [0x0446, 'pa'], [0x046B, 'qu-BO'], [0x086B, 'qu-EC'], [0x0C6B, 'qu'], [0x0418, 'ro'],
    [0x0417, 'rm'], [0x0419, 'ru'], [0x243B, 'smn'], [0x103B, 'smj-NO'], [0x143B, 'smj'], [0x0C3B, 'se-FI'],
    [0x043B, 'se'], [0x083B, 'se-SE'], [0x203B, 'sms'], [0x183B, 'sma-NO'], [0x1C3B, 'sms'], [0x044F, 'sa'],
    [0x1C1A, 'sr-Cyrl-BA'], [0x0C1A, 'sr'], [0x181A, 'sr-Latn-BA'], [0x081A, 'sr-Latn'], [0x046C, 'nso'],
    [0x0432, 'tn'], [0x045B, 'si'], [0x041B, 'sk'], [0x0424, 'sl'], [0x2C0A, 'es-AR'], [0x400A, 'es-BO'],
    [0x340A, 'es-CL'], [0x240A, 'es-CO'], [0x140A, 'es-CR'], [0x1C0A, 'es-DO'], [0x300A, 'es-EC'], [0x440A, 'es-SV'],
    [0x100A, 'es-GT'], [0x480A, 'es-HN'], [0x080A, 'es-MX'], [0x4C0A, 'es-NI'], [0x180A, 'es-PA'], [0x3C0A, 'es-PY'],
    [0x280A, 'es-PE'], [0x500A, 'es-PR'], [0x0C0A, 'es'], [0x040A, 'es'], [0x540A, 'es-US'], [0x380A, 'es-UY'],
    [0x200A, 'es-VE'], [0x081D, 'sv-FI'], [0x041D, 'sv'], [0x045A, 'syr'], [0x0428, 'tg'], [0x085F, 'tzm'],
    [0x0449, 'ta'], [0x0444, 'tt'], [0x044A, 'te'], [0x041E, 'th'], [0x0451, 'bo'], [0x041F, 'tr'], [0x0442, 'tk'],
    [0x0480, 'ug'], [0x0422, 'uk'], [0x042E, 'hsb'], [0x0420, 'ur'], [0x0843, 'uz-Cyrl'], [0x0443, 'uz'],
    [0x042A, 'vi'], [0x0452, 'cy'], [0x0488, 'wo'], [0x0485, 'sah'], [0x0478, 'ii'], [0x046A, 'yo'],
]);

export function getLanguage(
    platformID: number,
    languageID: number,
    langTags: string[] | null,
    ltag: string[] | null,
): string {
    // find out what language this is for
    let lang: string | undefined;
    switch (platformID) {
        case 0: // Unicode
            if (languageID === 0xFFFF) lang = 'und';
            else if (ltag) lang = ltag[languageID];
            break;
        case 1: // Mac
            lang = macLanguages[languageID];
            break;
        case 3: // Windows
            lang = windowsLanguages.get(languageID);
            break;
        // no default
    }
    if (!lang && langTags && languageID >= 0x8000) {
        lang = langTags[languageID - 0x8000];
    }
    return (lang ?? `${platformID}-${languageID}`).toLowerCase();
}

export function getUserLocale(): string[] {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase(),
        match = /^([a-z]{2,3})(?=[-_])/.exec(locale);
    // add english as a fallback
    if (!match) return locale !== 'en' ? [locale, 'en'] : [locale];
    const lang = match[1]!;
    return lang !== 'en' ? [locale, lang, 'en'] : [locale, lang];
}

const platformPreference = [1, 3, 0];

function matchRecord(records: NameRecord[], locales: string[]): string {
    for (const tag of locales) {
        const matchedRecords = records.filter(({ lang }) => lang === tag);
        if (matchedRecords.length) {
            // if there are multiple records for this name id & lang, return the one with the most preffered platform
            return (matchedRecords.length > 1 ? matchedRecords.sort((a, b) => (
                platformPreference.indexOf(b.platformID)
                - platformPreference.indexOf(a.platformID)
            )) : matchedRecords)[0]!.string;
        }
    }
    // else return the first record regardless of language
    return records[0]!.string;
}

export function localizeNames(records: NameRecord[]) {
    // create a map that groups name table entries by name id
    const localized = new Map<number, NameRecord[]>();
    for (const record of records) {
        if (!localized.has(record.nameID)) localized.set(record.nameID, []);
        localized.get(record.nameID)!.push(record);
    }
    const locales = getUserLocale(),
        names: Record<number, string> = {};
    for (const [id, items] of localized.entries()) {
        names[id] = matchRecord(items, locales);
    }
    return names;
}

export function caselessMatch(names: string[], match: string): string | null {
    for (const name of names) {
        if (name.localeCompare(match, undefined, { sensitivity: 'accent' }) === 0) {
            return name;
        }
    }
    return null;
}