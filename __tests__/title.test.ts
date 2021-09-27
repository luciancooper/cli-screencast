import type { Title } from '@src/types';
import { resolveTheme } from '@src/theme';
import { matchIcon, parseTitle, resolveTitle } from '@src/title';
import * as ansi from './helpers/ansi';
import makeStyle from './helpers/style';

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
        expect(parsed).toEqual<ReturnType<typeof parseTitle>>({
            columns: 10,
            chunks: [{ str: 'bold title', x: [0, 10], style: makeStyle({ bold: true }) }],
        });
    });

    test('parse styled string with multiple chunks', () => {
        const parsed = parseTitle(palette, `title with ${ansi.bold('bold')} and ${ansi.fg(32, 'green')} text`);
        expect(parsed).toEqual<ReturnType<typeof parseTitle>>({
            columns: 30,
            chunks: [
                { str: 'title with ', x: [0, 11], style: makeStyle() },
                { str: 'bold', x: [11, 4], style: makeStyle({ bold: true }) },
                { str: ' and ', x: [15, 5], style: makeStyle() },
                { str: 'green', x: [20, 5], style: makeStyle({ fg: theme.green }) },
                { str: ' text', x: [25, 5], style: makeStyle() },
            ],
        });
    });

    test('ignore styled chunk containing only zero width character', () => {
        const parsed = parseTitle(palette, `title ${ansi.fg(32, '\x1F')}text`);
        expect(parsed).toEqual<ReturnType<typeof parseTitle>>({
            columns: 10,
            chunks: [
                { str: 'title text', x: [0, 10], style: makeStyle() },
            ],
        });
    });
});

describe('resolveTitle', () => {
    test('no icon argument', () => {
        expect(resolveTitle(palette, 'title'))
            .toMatchObject<Partial<Title>>({ text: 'title', icon: undefined });
    });

    test('icon argument is a string', () => {
        expect(resolveTitle(palette, 'title', 'node'))
            .toMatchObject<Partial<Title>>({ text: 'title', icon: 'node' });
    });

    test('icon argument is `true`', () => {
        expect(resolveTitle(palette, 'node cmd', true))
            .toMatchObject<Partial<Title>>({ text: 'node cmd', icon: 'node' });
    });

    test('text argument is undefined', () => {
        expect(resolveTitle(palette, undefined, true))
            .toMatchObject<Partial<Title>>({ text: undefined, icon: 'shell' });
    });
});