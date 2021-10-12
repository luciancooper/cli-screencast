import type { Title, TextLine } from '@src/types';
import { resolveTheme } from '@src/theme';
import { matchIcon, parseTitle, resolveTitle } from '@src/title';
import { makeLine } from './helpers/objects';
import * as ansi from './helpers/ansi';

const { theme, palette } = resolveTheme();

describe('matchIcon', () => {
    test('return fallback icon when input string is empty', () => {
        expect(matchIcon('', 'node')).toBe('node');
    });

    test('return fallback icon when a match is not found on input string', () => {
        expect(matchIcon('ls dir', 'shell')).toBe('shell');
    });

    test('map icon alias names to their id', () => {
        expect(matchIcon('tsnode')).toBe('ts-node');
    });
});

describe('parseTitle', () => {
    test('parse styled string', () => {
        const parsed = parseTitle(palette, ansi.bold('bold title'));
        expect(parsed).toEqual<TextLine>(makeLine(['bold title', { bold: true }]));
    });

    test('parse styled string with multiple chunks', () => {
        const parsed = parseTitle(palette, `title with ${ansi.bold('bold')} and ${ansi.fg(32, 'green')} text`);
        expect(parsed).toEqual<TextLine>(makeLine(
            'title with ',
            ['bold', { bold: true }],
            ' and ',
            ['green', { fg: theme.green }],
            ' text',
        ));
    });

    test('ignore styled chunk containing only zero width character', () => {
        const parsed = parseTitle(palette, `title ${ansi.fg(32, '\x1F')}text`);
        expect(parsed).toEqual<TextLine>(makeLine('title text'));
    });
});

describe('resolveTitle', () => {
    test('no icon argument', () => {
        expect(resolveTitle(palette, 'title'))
            .toEqual<Title>({ text: 'title', icon: undefined, ...makeLine('title') });
    });

    test('icon argument is a string', () => {
        expect(resolveTitle(palette, 'title', 'node'))
            .toEqual<Title>({ text: 'title', icon: 'node', ...makeLine('title') });
    });

    test('icon argument is `true`', () => {
        expect(resolveTitle(palette, 'node cmd', true))
            .toEqual<Title>({ text: 'node cmd', icon: 'node', ...makeLine('node cmd') });
    });

    test('text argument is undefined', () => {
        expect(resolveTitle(palette, undefined, true))
            .toEqual<Title>({ text: undefined, icon: 'shell', ...makeLine() });
    });
});