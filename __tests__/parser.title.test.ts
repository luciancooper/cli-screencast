import type { Title, TextLine } from '@src/types';
import { matchIcon, parseTitle, resolveTitle, applyTitleEscape } from '@src/parser/title';
import { makeLine } from './helpers/objects';
import * as ansi from './helpers/ansi';

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
        const parsed = parseTitle(ansi.bold('bold title'));
        expect(parsed).toEqual<TextLine>(makeLine(['bold title', { bold: true }]));
    });

    test('parse styled string with multiple chunks', () => {
        const parsed = parseTitle(`title with ${ansi.bold('bold')} and ${ansi.fg(32, 'green')} text`);
        expect(parsed).toEqual<TextLine>(makeLine(
            'title with ',
            ['bold', { bold: true }],
            ' and ',
            ['green', { fg: 2 }],
            ' text',
        ));
    });

    test('ignore styled chunk containing only zero width character', () => {
        const parsed = parseTitle(`title ${ansi.fg(32, '\x1F')}text`);
        expect(parsed).toEqual<TextLine>(makeLine('title text'));
    });
});

describe('resolveTitle', () => {
    test('no icon argument', () => {
        expect(resolveTitle('title')).toEqual<Title>({ icon: null, ...makeLine('title') });
    });

    test('icon argument is a string', () => {
        expect(resolveTitle('title', 'node')).toEqual<Title>({ icon: 'node', ...makeLine('title') });
    });

    test('icon argument is `true`', () => {
        expect(resolveTitle('node cmd', true)).toEqual<Title>({ icon: 'node', ...makeLine('node cmd') });
    });

    test('text argument is undefined', () => {
        expect(resolveTitle(undefined, true)).toEqual<Title>({ icon: 'shell', ...makeLine() });
    });

    test('text and icon are undefined', () => {
        expect(resolveTitle()).toBeNull();
    });
});

describe('applyTitleEscape', () => {
    test('apply escape to change a title', () => {
        const title: Title = { icon: 'node', ...makeLine('title') };
        expect(applyTitleEscape(title, 0, 'new title')).toEqual<Title>({ icon: 'shell', ...makeLine('new title') });
        expect(applyTitleEscape(title, 1, 'search')).toEqual<Title>({ ...title, icon: 'search' });
        expect(applyTitleEscape(title, 2, 'new title')).toEqual<Title>({ ...title, ...makeLine('new title') });
    });

    test('apply escape to an empty title', () => {
        expect(applyTitleEscape(null, 0, 'title')).toEqual<Title>({ icon: 'shell', ...makeLine('title') });
        expect(applyTitleEscape(null, 1, 'node')).toEqual<Title>({ icon: 'node', ...makeLine() });
        expect(applyTitleEscape(null, 2, 'title')).toEqual<Title>({ icon: null, ...makeLine('title') });
    });

    test('apply empty escapes', () => {
        const title: Title = { icon: 'node', ...makeLine('title') };
        expect(applyTitleEscape(title, 0, '')).toBeNull();
        expect(applyTitleEscape(title, 1, '')).toEqual<Title>({ ...title, icon: null });
        expect(applyTitleEscape(title, 2, '')).toEqual<Title>({ ...title, ...makeLine() });
    });

    test('apply empty escape to an empty title', () => {
        expect(applyTitleEscape(null, 0, '')).toBeNull();
        expect(applyTitleEscape(null, 1, '')).toBeNull();
        expect(applyTitleEscape(null, 2, '')).toBeNull();
    });
});