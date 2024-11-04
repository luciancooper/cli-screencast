import { create } from 'react-test-renderer';
import { applyDefRenderOptions } from '@src/options';
import { resolveTheme } from '@src/theme';
import { resolveTitle } from '@src/parser';
import { hexString } from '@src/color';
import type { CursorKeyFrame } from '@src/types';
import type { KeyTime } from '@src/render/Animation';
import { resolveContext, type RenderOptions } from '@src/render';
import Context from '@src/render/Context';
import Window from '@src/render/Window';
import WindowTitle from '@src/render/WindowTitle';
import createBoxShadow, { defaultBoxShadow, type BoxShadowOptions } from '@src/render/BoxShadow';
import Text from '@src/render/Text';
import { Cursor, CursorFrames, opacityKeyTimes, translateKeyTimes } from '@src/render/Cursor';
import * as ansi from './helpers/ansi';

const defTheme = resolveTheme();

const defOptions: RenderOptions = {
    fontSize: 2,
    columnWidth: 0.5,
    lineHeight: 1,
};

type RenderableData = Parameters<typeof resolveContext>[1];

const defData: RenderableData = {
    columns: 50,
    rows: 50,
    duration: 0,
};

const render = (element: any, options: RenderOptions = {}, data: Partial<RenderableData> = {}) => {
    const context = resolveContext(applyDefRenderOptions({ ...defOptions, ...options }), { ...defData, ...data });
    return create(
        <Context.Provider value={context}>
            {element}
        </Context.Provider>,
    ).toJSON();
};

describe('<Window/>', () => {
    test('render a root <svg> that wraps an inner content <svg> element', () => {
        expect(render(<Window/>, { decorations: false, paddingX: 0, paddingY: 0 })).toMatchObject({
            type: 'svg',
            props: { width: expect.toBeNumber(), height: expect.toBeNumber() },
            children: [
                { type: 'style' },
                { type: 'rect', props: { className: 'window-background' } },
                { type: 'svg', props: { className: 'terminal-content' } },
            ],
        });
    });

    test('render window decorations by default', () => {
        expect(render(<Window/>, { insetMajor: 40, insetMinor: 20 })).toMatchObject({
            type: 'svg',
            props: { width: expect.toBeNumber(), height: expect.toBeNumber() },
            children: [
                { type: 'style' },
                { type: 'rect', props: { className: 'window-background' } },
                { type: 'g', children: [{ type: 'circle' }, { type: 'circle' }, { type: 'circle' }] },
                { type: 'svg', props: { className: 'terminal-content' } },
            ],
        });
    });

    test('render with box shadow', () => {
        expect(render(<Window/>, { decorations: false, boxShadow: defaultBoxShadow })).toMatchObject({
            type: 'svg',
            children: [
                { type: 'style' },
                { type: 'filter', props: { id: 'bs-d2b4-00000080' } },
                { type: 'rect', props: { className: 'window-background', filter: 'url(#bs-d2b4-00000080)' } },
                { type: 'svg', props: { className: 'terminal-content' } },
            ],
        });
    });

    test('render with a title', () => {
        const title = resolveTitle('window title', 'node');
        expect(render(<Window title={title}/>, { decorations: false }, { title })).toMatchObject({
            type: 'svg',
            children: [
                { type: 'style' },
                { type: 'defs', children: [{ type: 'symbol', props: { id: 'node' } }] },
                { type: 'rect', props: { className: 'window-background' } },
                {
                    type: 'svg',
                    props: { className: 'window-title' },
                    children: [{ type: 'g', props: { className: 'title-frame' } }],
                },
                { type: 'svg', props: { className: 'terminal-content' } },
            ],
        });
    });

    test('render with title frames', () => {
        const title = [
            { ...resolveTitle('first title frame', 'shell'), time: 0, endTime: 1000 },
            { ...resolveTitle('second title frame', 'node'), time: 1000, endTime: 2000 },
        ];
        expect(render(<Window title={title}/>, { decorations: false }, { title, duration: 2000 })).toMatchObject({
            type: 'svg',
            children: [
                { type: 'style' },
                {
                    type: 'defs',
                    children: [
                        { type: 'symbol', props: { id: 'shell' } },
                        { type: 'symbol', props: { id: 'node' } },
                    ],
                },
                { type: 'rect', props: { className: 'window-background' } },
                {
                    type: 'svg',
                    props: { className: 'window-title' },
                    children: [
                        { type: 'g', props: { className: 'title-frame' } },
                        { type: 'g', props: { className: 'title-frame' } },
                    ],
                },
                { type: 'svg', props: { className: 'terminal-content' } },
            ],
        });
    });
});

describe('createBoxShadow', () => {
    const baseOptions: Required<BoxShadowOptions> = {
        dx: 0,
        dy: 0,
        spread: 0,
        blurRadius: 0,
        color: [0, 0, 0, 0.5],
    };

    test('correctly chains filter primitives', () => {
        const [id, element] = createBoxShadow({
            ...baseOptions,
            dx: 2,
            dy: 2,
            spread: [2, 3],
            blurRadius: 4,
        })!;
        expect(id).toBe('bs-d2-3x2y2b4-00000080');
        expect(create(element).toJSON()).toStrictEqual({
            type: 'filter',
            props: { id, filterUnits: 'userSpaceOnUse' },
            children: [
                expect.objectContaining({
                    type: 'feMorphology',
                    props: { operator: 'dilate', radius: '2,3', in: 'SourceAlpha' },
                }),
                expect.objectContaining({ type: 'feOffset', props: { dx: 2, dy: 2 } }),
                expect.objectContaining({ type: 'feGaussianBlur', props: { stdDeviation: 4, result: 'Shadow' } }),
                expect.objectContaining({ type: 'feFlood', props: { floodColor: '#000000', floodOpacity: 0.5 } }),
                expect.objectContaining({ type: 'feComposite', props: { in2: 'Shadow', operator: 'in' } }),
                expect.objectContaining({
                    type: 'feMerge',
                    children: [
                        { type: 'feMergeNode', props: {}, children: null },
                        { type: 'feMergeNode', props: { in: 'SourceGraphic' }, children: null },
                    ],
                }),
            ],
        });
    });

    test('returns null when box shadow options are all zero', () => {
        expect(createBoxShadow(baseOptions)).toBeNull();
    });

    test('returns null when specified color is fully transparent', () => {
        expect(createBoxShadow({ ...baseOptions, spread: 2, color: [0, 0, 0, 0] })).toBeNull();
    });

    test('specified color can be an rgba string', () => {
        const [id, element] = createBoxShadow({ ...baseOptions, blurRadius: 3, color: 'rgba(255, 0, 0, 0.5)' })!;
        expect(id).toBe('bs-b3-ff000080');
        expect(create(element).toJSON()).toMatchObject({
            type: 'filter',
            props: { id },
            children: [
                { type: 'feGaussianBlur', props: { stdDeviation: 3, in: 'SourceAlpha', result: 'Shadow' } },
                { type: 'feFlood', props: { floodColor: '#ff0000', floodOpacity: 0.5 } },
                { type: 'feComposite' },
                { type: 'feMerge' },
            ],
        });
    });

    describe('feMorphology primitives', () => {
        test('uses `erode` operator when spread is negative', () => {
            const [id, element] = createBoxShadow({ ...baseOptions, spread: [0, -2] })!;
            expect(id).toBe('bs-e0-2-00000080');
            expect(create(element).toJSON()).toMatchObject({
                type: 'filter',
                props: { id },
                children: [
                    { type: 'feMorphology', props: { operator: 'erode', radius: '0,2', result: 'Shadow' } },
                    { type: 'feFlood' },
                    { type: 'feComposite' },
                    { type: 'feMerge' },
                ],
            });
        });

        test('sequential `erode` then `dilate` primitives if x radius < 0 & y radius > 0', () => {
            const [id, element] = createBoxShadow({ ...baseOptions, spread: [-2, 3] })!;
            expect(id).toBe('bs-e2d3-00000080');
            expect(create(element).toJSON()).toMatchObject({
                type: 'filter',
                children: [
                    { type: 'feMorphology', props: { operator: 'erode', radius: '2,0', in: 'SourceAlpha' } },
                    { type: 'feMorphology', props: { operator: 'dilate', radius: '0,3', result: 'Shadow' } },
                    { type: 'feFlood' },
                    { type: 'feComposite' },
                    { type: 'feMerge' },
                ],
            });
        });

        test('sequential `dilate` then `erode` primitives if x radius > 0 & y radius < 0', () => {
            const [id, element] = createBoxShadow({ ...baseOptions, spread: [3, -3] })!;
            expect(id).toBe('bs-d3e3-00000080');
            expect(create(element).toJSON()).toMatchObject({
                type: 'filter',
                children: [
                    { type: 'feMorphology', props: { operator: 'dilate', radius: '3,0', in: 'SourceAlpha' } },
                    { type: 'feMorphology', props: { operator: 'erode', radius: '0,3', result: 'Shadow' } },
                    { type: 'feFlood' },
                    { type: 'feComposite' },
                    { type: 'feMerge' },
                ],
            });
        });
    });
});

describe('<WindowTitle/>', () => {
    test('render centered title text and icon', () => {
        expect(render(
            <WindowTitle columnInset={0} title={resolveTitle('window title', 'shell')}/>,
        )).toMatchObject({
            type: 'g',
            props: { className: 'title-frame' },
            children: [
                { type: 'use', props: { x: 17.2 } },
                { type: 'text', props: { x: 20 }, children: ['window title'] },
            ],
        });
    });

    test('render only icon', () => {
        expect(render(<WindowTitle columnInset={0} title={resolveTitle(undefined, 'shell')}/>))
            .toMatchObject({ type: 'g', children: [{ type: 'use', props: { x: 24.2 } }] });
    });

    test('truncate styled title text to fit window columns', () => {
        expect(render(
            <WindowTitle columnInset={4} title={resolveTitle(`longer ${ansi.bold('window title')}`)}/>,
            {},
            { columns: 20 },
        )).toMatchObject({
            type: 'g',
            props: { className: 'title-frame' },
            children: [
                { type: 'text', props: { x: 4 }, children: ['longer '] },
                { type: 'text', props: { x: 11 }, children: ['window t…'] },
            ],
        });
    });

    test('truncate to fit title text and icon', () => {
        expect(render(
            <WindowTitle columnInset={4} title={resolveTitle('longer window title', 'shell')}/>,
            {},
            { columns: 20 },
        )).toMatchObject({
            type: 'g',
            props: { className: 'title-frame' },
            children: [
                { type: 'use', props: { x: 4.2 } },
                { type: 'text', props: { x: 7 }, children: ['longer windo…'] },
            ],
        });
    });

    test('render with animation keyframe', () => {
        expect(render(
            <WindowTitle
                columnInset={0}
                title={resolveTitle('window title frame')}
                keyFrame={{ time: 0, endTime: 1000 }}
            />,
            {},
            { duration: 2000 },
        )).toMatchObject({
            type: 'g',
            props: { className: 'title-frame' },
            children: [
                { type: 'text', props: { x: 16 }, children: ['window title frame'] },
                { type: 'animate', props: { attributeName: 'opacity' }, children: null },
            ],
        });
    });
});

describe('<Text/>', () => {
    test('renders style attribute props', () => {
        expect(render(
            <Text x={0} y={0} span={10} bold dim italic>text chunk</Text>,
        )).toMatchObject({
            type: 'text',
            props: { fontWeight: 'bold', fontStyle: 'italic', opacity: defTheme.dim },
            children: ['text chunk'],
        });
    });

    test('handles overlap of the `underline` and `strikeThrough` props', () => {
        expect(render(
            <Text x={0} y={0} span={15} underline strikeThrough>text decoration</Text>,
        )).toMatchObject({
            type: 'text',
            props: { textDecoration: 'underline line-through' },
            children: ['text decoration'],
        });
    });

    test('renders a <rect> sibling element when `background` is styled', () => {
        expect(render(
            <Text x={0} y={0} span={10} bg={[255, 0, 255]}>background</Text>,
        )).toMatchObject([
            { type: 'rect', props: { fill: '#ff00ff' } },
            { type: 'text', children: ['background'] },
        ]);
    });

    test('renders multiple column aligned <text> elements when content contains full width chars', () => {
        expect(render(
            <Text x={0} y={0} span={33}>kiss: 👨‍❤️‍💋‍👨 family: 👨‍👩‍👧‍👧 astronaut: 🧑🏾‍🚀</Text>,
        )).toMatchObject({
            type: 'g',
            props: { fill: hexString(defTheme.text) },
            children: [
                { type: 'text', props: { x: 0, y: 1 }, children: ['kiss: 👨‍❤️‍💋‍👨'] },
                { type: 'text', props: { x: 8, y: 1 }, children: [' family: 👨‍👩‍👧‍👧'] },
                { type: 'text', props: { x: 19, y: 1 }, children: [' astronaut: 🧑🏾‍🚀'] },
            ],
        });
    });

    test('swaps foreground and background when the `inverted` prop is passed', () => {
        expect(render(
            <Text x={0} y={0} span={8} inverted>inverted</Text>,
        )).toMatchObject([
            { type: 'rect', props: { fill: hexString(defTheme.text) } },
            { type: 'text', props: { fill: hexString(defTheme.background) }, children: ['inverted'] },
        ]);
        expect(render(
            <Text x={0} y={0} span={8} fg={1} bg={3} inverted>inverted</Text>,
        )).toMatchObject([
            { type: 'rect', props: { fill: hexString(defTheme.red) } },
            { type: 'text', props: { fill: hexString(defTheme.yellow) }, children: ['inverted'] },
        ]);
    });

    test('wraps <text> element in a <a> tag when `link` prop is present', () => {
        expect(render(
            <Text x={0} y={0} span={10} link='https://google.com'>google.com</Text>,
        )).toMatchObject({
            type: 'a',
            props: { href: 'https://google.com' },
            children: [{ type: 'text', children: ['google.com'] }],
        });
    });
});

describe('<Cursor/>', () => {
    test('renders with an opacity animation when `cursorBlink` theme prop is enabled', () => {
        const theme = resolveTheme({ cursorBlink: true });
        expect(render(<Cursor line={0} column={0}/>, { theme })).toMatchObject({
            type: 'rect',
            children: [{ type: 'animate', props: { attributeName: 'opacity' } }],
        });
    });

    test('renders a beam shaped rect when the `cursorType` theme prop is set to `beam`', () => {
        const theme = resolveTheme({ cursorType: 'beam' });
        expect(render(<Cursor line={0} column={0}/>, { theme, lineHeight: 0.5 })).toMatchObject({
            type: 'rect',
            props: { y: 0, width: 0.15, height: 1 },
        });
    });

    test('renders a block shaped rect when the `cursorType` theme prop is set to `block`', () => {
        const theme = resolveTheme({ cursorType: 'block' });
        expect(render(<Cursor line={0} column={0}/>, { theme, lineHeight: 0.5 })).toMatchObject({
            type: 'rect',
            props: { y: 0, width: 1, height: 1 },
        });
    });

    test('renders an underline shaped rect when the `cursorType` theme prop is set to `underline`', () => {
        const theme = resolveTheme({ cursorType: 'underline' });
        expect(render(<Cursor line={0} column={0}/>, { theme, lineHeight: 0.5 })).toMatchObject({
            type: 'rect',
            props: { y: 0.9, width: 1, height: 0.10 },
        });
    });
});

describe('<CursorFrames/>', () => {
    const makeFrames = (stages: ([line: number, col: number] | null)[], stageDuration = 500) => [
        stages.map<CursorKeyFrame | null>((stage, i) => (stage ? {
            time: i * stageDuration,
            endTime: (i + 1) * stageDuration,
            line: stage[0],
            column: stage[1],
        } : null)).filter((frame) => frame !== null) as CursorKeyFrame[],
        stages.length * stageDuration,
    ] as const;

    test('renders a `rect` element with `animate` and `animateTransform` children', () => {
        const [frames, duration] = makeFrames([[0, 5], [1, 5], null, null]);
        expect(render(<CursorFrames frames={frames}/>, {}, { duration })).toMatchObject({
            type: 'rect',
            children: [
                { type: 'animate', children: null },
                { type: 'animateTransform', children: null },
            ],
        });
    });

    describe('opacityKeyTimes', () => {
        test('returns array of cursor opacity values and times', () => {
            expect(opacityKeyTimes(...makeFrames([null, [0, 5], null, [1, 10]]))).toEqual<KeyTime<number>[]>([
                { value: 0, time: 0 },
                { value: 1, time: 0.25 },
                { value: 0, time: 0.5 },
                { value: 1, time: 0.75 },
            ]);
            // ends with a null frame
            expect(opacityKeyTimes(...makeFrames([null, null, [1, 10], null]))).toEqual<KeyTime<number>[]>([
                { value: 0, time: 0 },
                { value: 1, time: 0.5 },
                { value: 0, time: 0.75 },
            ]);
        });

        test('returns an empty array if cursor visibility never changes', () => {
            const [frames, duration] = makeFrames([[0, 5], [1, 5]]);
            expect(opacityKeyTimes(frames, duration)).toHaveLength(0);
        });
    });

    describe('transformKeyTimes', () => {
        test('returns array of cursor translation values and times', () => {
            const [frames, duration] = makeFrames([[0, 5], [1, 5], [1, 10], [2, 5]]);
            expect(translateKeyTimes(frames, duration, [1, 1])).toEqual<KeyTime<string>[]>([
                { value: '0,0', time: 0 },
                { value: '0,1', time: 0.25 },
                { value: '5,1', time: 0.5 },
                { value: '0,2', time: 0.75 },
            ]);
        });

        test('does not include position changes when cursor is hidden', () => {
            const [frames, duration] = makeFrames([[0, 5], [1, 5], null, [1, 5]]);
            expect(translateKeyTimes(frames, duration, [1, 1])).toEqual<KeyTime<string>[]>([
                { value: '0,0', time: 0 },
                { value: '0,1', time: 0.25 },
            ]);
        });

        test('returns empty array when cursor is only visible during a single frame', () => {
            const [frames, duration] = makeFrames([null, null, [1, 10], null]);
            expect(translateKeyTimes(frames, duration, [1, 1])).toHaveLength(0);
        });
    });
});