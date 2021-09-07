import { create } from 'react-test-renderer';
import { resolveTheme } from '@src/theme';
import Context from '@src/render/Context';
import Window from '@src/render/Window';
import Text from '@src/render/Text';
import { Cursor, CursorFrames, opacityKeyTimes, translateKeyTimes } from '@src/render/Cursor';

const { theme: defTheme } = resolveTheme({ fontSize: 1, lineHeight: 1 });

const render = (element: any, theme = defTheme) => create(
    <Context.Provider value={theme}>
        {element}
    </Context.Provider>,
).toJSON();

describe('<Window/>', () => {
    test('renders a root <svg> that wraps an inner viewBox <svg> element', () => {
        expect(render(
            <Window columns={50} rows={10} decorations={false} paddingX={0} paddingY={0}/>,
        )).toMatchObject({
            type: 'svg',
            props: { width: 50 * 10, height: 10 * 10 },
            children: [
                { type: 'rect', props: { className: 'window-background' } },
                { type: 'svg', props: { width: 50 * 10, height: 10 * 10, viewBox: expect.any(String) as string } },
            ],
        });
    });

    test('renders window decorations by default', () => {
        expect(render(<Window columns={50} rows={10}/>)).toMatchObject({
            type: 'svg',
            props: { width: expect.any(Number) as number, height: expect.any(Number) as number },
            children: [
                { type: 'rect', props: { className: 'window-background' } },
                { type: 'g', props: { className: 'window-decorations' } },
                { type: 'svg', props: { viewBox: expect.any(String) as string } },
            ],
        });
    });
});

describe('<Text/>', () => {
    test('renders style attribute props', () => {
        expect(render(
            <Text x={0} span={10} bold dim italic>text chunk</Text>,
        )).toMatchObject({
            type: 'text',
            props: { fontWeight: 'bold', fontStyle: 'italic', opacity: defTheme.dim },
            children: ['text chunk'],
        });
    });

    test('handles overlap of the `underline` and `strikeThrough` props', () => {
        expect(render(
            <Text x={0} span={0} underline strikeThrough/>,
        )).toMatchObject({
            type: 'text',
            props: { textDecoration: 'underline line-through' },
        });
    });

    test('renders a <rect> sibling element when `background` is styled', () => {
        expect(render(
            <Text x={0} span={10} background='#ff00ff'>background</Text>,
        )).toMatchObject([
            { type: 'rect', props: { fill: '#ff00ff' } },
            { type: 'text', children: ['background'] },
        ]);
    });

    test('swaps foreground and background when the `inverted` prop is passed', () => {
        expect(render(
            <Text x={0} span={8} inverted>inverted</Text>,
        )).toMatchObject([
            { type: 'rect', props: { fill: defTheme.text } },
            { type: 'text', props: { fill: defTheme.background }, children: ['inverted'] },
        ]);
        expect(render(
            <Text x={0} span={8} foreground={defTheme.red} background={defTheme.yellow} inverted>inverted</Text>,
        )).toMatchObject([
            { type: 'rect', props: { fill: defTheme.red } },
            { type: 'text', props: { fill: defTheme.yellow }, children: ['inverted'] },
        ]);
    });

    test('wraps <text> element in a <a> tag when `link` prop is present', () => {
        expect(render(
            <Text x={0} span={10} link='https://google.com'>google.com</Text>,
        )).toMatchObject({
            type: 'a',
            props: { href: 'https://google.com' },
            children: [{ type: 'text', children: ['google.com'] }],
        });
    });
});

describe('<Cursor/>', () => {
    test('renders with an opacity animation when `cursorBlink` theme prop is enabled', () => {
        const { theme } = resolveTheme({ cursorBlink: true });
        expect(render(<Cursor line={0} column={0}/>, theme)).toMatchObject({
            type: 'rect',
            children: [{ type: 'animate', props: { attributeName: 'opacity' } }],
        });
    });

    test('renders a beam shaped rect when the `cursorType` theme prop is set to `beam`', () => {
        const { theme } = resolveTheme({ cursorType: 'beam', fontSize: 1, lineHeight: 1 });
        expect(render(<Cursor line={0} column={0}/>, theme)).toMatchObject({
            type: 'rect',
            props: { y: 0, width: 0.15, height: 1 },
        });
    });

    test('renders a block shaped rect when the `cursorType` theme prop is set to `block`', () => {
        const { theme } = resolveTheme({ cursorType: 'block', fontSize: 1, lineHeight: 1 });
        expect(render(<Cursor line={0} column={0}/>, theme)).toMatchObject({
            type: 'rect',
            props: { y: 0, width: 1, height: 1 },
        });
    });

    test('renders an underline shaped rect when the `cursorType` theme prop is set to `underline`', () => {
        const { theme } = resolveTheme({ cursorType: 'underline', fontSize: 1, lineHeight: 1 });
        expect(render(<Cursor line={0} column={0}/>, theme)).toMatchObject({
            type: 'rect',
            props: { y: 0.9, width: 1, height: 0.10 },
        });
    });
});

describe('<CursorFrames/>', () => {
    const makeFrames = (stages: [0 | 1, number, number][], stageDuration = 500) => ({
        frames: stages.map(([hidden, line, column], i) => ({
            time: i * stageDuration,
            endTime: (i + 1) * stageDuration,
            line,
            column,
            hidden: Boolean(hidden ^ 1),
        })),
        duration: stages.length * stageDuration,
    });

    test('renders a `rect` element with `animate` and `animateTransform` children', () => {
        expect(render(
            <CursorFrames {...makeFrames([[1, 0, 5], [1, 1, 5], [0, 1, 10], [0, 1, 10]])}/>,
        )).toMatchObject({
            type: 'rect',
            children: [
                { type: 'animate', children: null },
                { type: 'animateTransform', children: null },
            ],
        });
    });

    describe('opacityKeyTimes', () => {
        test('returns array of cursor opacity values and times', () => {
            const { frames, duration } = makeFrames([[0, 0, 5], [0, 1, 5], [1, 1, 10], [0, 1, 10]]),
                keyTimes = opacityKeyTimes(frames, duration);
            expect(keyTimes).toEqual<typeof keyTimes>([
                { value: 0, time: 0 },
                { value: 1, time: 0.5 },
                { value: 0, time: 0.75 },
            ]);
        });

        test('returns an empty array if cursor visibility never changes', () => {
            const { frames, duration } = makeFrames([[1, 0, 5], [1, 1, 5]]);
            expect(opacityKeyTimes(frames, duration)).toHaveLength(0);
        });
    });

    describe('transformKeyTimes', () => {
        test('returns array of cursor translation values and times', () => {
            const { frames, duration } = makeFrames([[1, 0, 5], [1, 1, 5], [1, 1, 10], [1, 2, 5]]),
                keyTimes = translateKeyTimes(frames, duration);
            expect(keyTimes).toEqual<typeof keyTimes>([
                { value: '0,0', time: 0 },
                { value: '0,1', time: 0.25 },
                { value: '5,1', time: 0.5 },
                { value: '0,2', time: 0.75 },
            ]);
        });

        test('does not include position changes when cursor is hidden', () => {
            const { frames, duration } = makeFrames([[1, 0, 5], [1, 1, 5], [0, 1, 10], [1, 1, 5]]),
                keyTimes = translateKeyTimes(frames, duration);
            expect(keyTimes).toEqual<typeof keyTimes>([
                { value: '0,0', time: 0 },
                { value: '0,1', time: 0.25 },
            ]);
        });

        test('returns empty array when cursor is only visible during a single frame', () => {
            const { frames, duration } = makeFrames([[0, 0, 5], [0, 1, 5], [1, 1, 10], [0, 1, 10]]);
            expect(translateKeyTimes(frames, duration)).toHaveLength(0);
        });
    });
});