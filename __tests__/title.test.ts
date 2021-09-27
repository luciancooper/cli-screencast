import type { Title } from '@src/types';
import { matchIcon, resolveTitle } from '@src/title';

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

describe('resolveTitle', () => {
    test('no icon argument', () => {
        expect(resolveTitle('title')).toEqual<Title>({ text: 'title' });
    });

    test('icon argument is a string', () => {
        expect(resolveTitle('title', 'node')).toEqual<Title>({ text: 'title', icon: 'node' });
    });

    test('icon argument is `true`', () => {
        expect(resolveTitle('node cmd', true)).toEqual<Title>({ text: 'node cmd', icon: 'node' });
    });

    test('text argument is undefined', () => {
        expect(resolveTitle(undefined, true)).toEqual<Title>({ icon: 'shell' });
    });
});