import { join as joinPath } from 'path';
import type { NameRecord } from '@src/fonts/types';
import FontDecoder from '@src/fonts/decoder';
import { getEncoding, decodeString } from '@src/fonts/encoding';
import { getLanguage, localizeNames } from '@src/fonts/names';

describe('getEncoding', () => {
    test('platform 0 - unicode', () => {
        expect(getEncoding(0, 0, 0)).toBe('utf-16be');
        expect(getEncoding(0, 1, 0)).toBe('utf-16be');
        expect(getEncoding(0, 2, 0)).toBe('utf-16be');
        expect(getEncoding(0, 3, 0)).toBe('utf-16be');
        expect(getEncoding(0, 4, 0)).toBe('utf-16be');
    });

    test('platform 1 - macintosh', () => {
        expect(getEncoding(1, 0, 17)).toBe('x-mac-turkish');
        expect(getEncoding(1, 0, 37)).toBe('x-mac-romanian');
        expect(getEncoding(1, 0, 45)).toBe('x-mac-roman');
    });

    test('platform 2 - iso', () => {
        expect(getEncoding(2, 0, 0)).toBe('ascii');
        expect(getEncoding(2, 2, 0)).toBe('iso-8859-1');
    });

    test('platform 3 - windows', () => {
        expect(getEncoding(3, 1, 0)).toBe('utf-16be');
        expect(getEncoding(3, 10, 0)).toBe('utf-16be');
    });

    test('unknown platform', () => {
        expect(getEncoding(5, 0, 0)).toBe('ascii');
    });
});

describe('decodeString', () => {
    test('decode utf-8', () => {
        const data = Buffer.from(new Uint8Array([0x74, 0x65, 0x73, 0x74]));
        expect(decodeString('utf-8', data, 0, data.length)).toBe('test');
    });

    test('decode utf-16be', () => {
        const data = Buffer.from(new Uint8Array([0xfe, 0xff, 0x00, 0x74, 0x00, 0x65, 0x00, 0x73, 0x00, 0x74]));
        expect(decodeString('utf-16be', data, 0, data.length)).toBe('test');
    });

    test('decode x-mac-roman', () => {
        const data = Buffer.from(new Uint8Array([0x74, 0x65, 0x73, 0x74]));
        expect(decodeString('x-mac-roman', data, 0, data.length)).toBe('test');
    });

    test('decode x-mac-roman double encoded', () => {
        const data = Buffer.from(new Uint8Array([0x00, 0x74, 0x00, 0x65, 0x00, 0x73, 0x00, 0x74]));
        expect(decodeString('x-mac-roman', data, 0, data.length)).toBe('test');
    });

    test('default to utf-16be', () => {
        const data = Buffer.from(new Uint8Array([0xfe, 0xff, 0x00, 0x74, 0x00, 0x65, 0x00, 0x73, 0x00, 0x74]));
        expect(decodeString('x-mac-icelandic', data, 0, data.length)).toBe('test');
    });
});

describe('getLanguage', () => {
    test('platform 0 - unicode', () => {
        expect(getLanguage(0, 0xFFFF, null, null)).toBe('und');
        expect(getLanguage(0, 0, null, null)).toBe('0-0');
    });

    test('platform 1 - macintosh', () => {
        expect(getLanguage(1, 0, null, null)).toBe('en');
        expect(getLanguage(1, 3, null, null)).toBe('it');
    });

    test('platform 3 - windows', () => {
        expect(getLanguage(3, 0x0409, null, null)).toBe('en');
        expect(getLanguage(3, 0x0410, null, null)).toBe('it');
    });

    test('extract from name table language ids or ltag array', () => {
        expect(getLanguage(1, 0x8000, ['zh-Hant'], null)).toBe('zh-hant');
        expect(getLanguage(0, 0, null, ['zh-Hant'])).toBe('zh-hant');
    });
});

describe('decode localized name map', () => {
    const decodeFixture = (fixture: string) => new FontDecoder({
        filePath: joinPath(__dirname, 'fixtures', fixture),
    }).decodeFirst(async function names(this: FontDecoder, header) {
        const ltag = await this.decodeSfntTable(header, 'ltag', this.ltagTable),
            name = (await this.decodeSfntTable(header, 'name', () => this.nameTable(ltag)))!;
        return { name, ltag, localized: localizeNames(name) };
    });

    test('decoder font', async () => {
        await expect(decodeFixture('decoder.ttf')).resolves.toMatchObject({
            name: expect.arrayContaining([
                expect.objectContaining({
                    nameID: 1, string: 'Decoder', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 1, string: 'Decoder', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 2, string: 'Regular', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 2, string: 'Regular', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 4, string: 'Decoder', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 4, string: 'Decoder', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 6, string: 'Decoder', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 6, string: 'Decoder', encoding: 'utf-16be', lang: 'en',
                }),
            ]) as Partial<NameRecord>[],
            localized: {
                1: 'Decoder',
                2: 'Regular',
                4: 'Decoder',
                6: 'Decoder',
            },
        });
    });

    test('font with ltag table', async () => {
        await expect(decodeFixture('ltag.otf')).resolves.toMatchObject({
            name: expect.arrayContaining([
                expect.objectContaining({
                    nameID: 1, string: 'Chinese', encoding: 'utf-16be', lang: 'zh-hant',
                }),
                expect.objectContaining({
                    nameID: 1, string: 'LtagTest', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 1, string: 'LtagTest', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 2, string: 'Regular', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 2, string: 'Regular', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 4, string: 'LtagTest Regular', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 4, string: 'LtagTest Regular', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 6, string: 'LtagTestRegular', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 6, string: 'LtagTestRegular', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 16, string: 'LtagTest2', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 16, string: 'LtagTest2', encoding: 'utf-16be', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 17, string: 'Regular', encoding: 'x-mac-roman', lang: 'en',
                }),
                expect.objectContaining({
                    nameID: 17, string: 'Regular', encoding: 'utf-16be', lang: 'en',
                }),
            ]) as Partial<NameRecord>[],
            ltag: ['zh-Hant'],
            localized: {
                1: 'LtagTest',
                2: 'Regular',
                4: 'LtagTest Regular',
                6: 'LtagTestRegular',
                16: 'LtagTest2',
                17: 'Regular',
            },
        });
    });
});