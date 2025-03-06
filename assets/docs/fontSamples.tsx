import { renderToStaticMarkup } from 'react-dom/server';
import { applyDefRenderOptions, applyDefTerminalOptions } from '@src/options';
import { parseScreen } from '@src/parser';
import Context, { useRenderContext } from '@src/render/Context';
import Window from '@src/render/Window';
import Frame from '@src/render/Frame';
import { Cursor } from '@src/render/Cursor';
import { resolveContext, type RenderOptions } from '@src/render';
import Asset, { embedFonts } from '../asset';

export function Grid({ color, thickness }: { color: string, thickness: number }) {
    const { columns: n, rows: m, grid: [dx, dy] } = useRenderContext(),
        gridPath = [
            ...Array(m + 1).fill(0).map((_, i) => `M0,${i * dy}h${dx * n}`),
            ...Array(n + 1).fill(0).map((_, j) => `M${j * dx},0v${m * dy}`),
        ].join('');
    return <path stroke={color} fill='none' strokeWidth={thickness} strokeLinecap='square' d={gridPath}/>;
}

const renderOptions: RenderOptions = {
    theme: { cursorBlink: true, cursorStyle: 'underline' },
    fontSize: 24,
    decorations: false,
    paddingY: 12,
    paddingX: 12,
    offsetY: 6,
    offsetX: 6,
};

async function renderFontSample(fontInfo: { fontFamily: string, fonts: string[] }) {
    const content = 'Hello World!',
        columns = content.length + 1,
        { css, ...font } = await embedFonts(content, fontInfo),
        parsed = parseScreen({ ...applyDefTerminalOptions({ columns, rows: 1 }), content }),
        context = resolveContext({ ...applyDefRenderOptions(renderOptions), ...font }, parsed);
    // adjust offset x to standardize all font sample svg sizes
    context.offset[0] += (context.fontSize * 0.65 - context.grid[0]) * columns / 2;
    // adjust size of the image according to the adjusted x offset
    context.size.width = context.window.width + context.offset[0] * 2;
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window css={css}>
                <Frame lines={parsed.lines}/>
                {parsed.cursor ? <Cursor animateBlink {...parsed.cursor}/> : null}
                <Grid color='#f00' thickness={1}/>
            </Window>
        </Context.Provider>,
    ).replace(/<svg class="terminal-content"/, '<svg class="terminal-content" overflow="visible"');
}

export default [
    new Asset({
        id: 'font-sample-UbuntuMono.svg',
        type: 'docs',
        render: () => renderFontSample({
            fontFamily: 'Ubuntu Mono',
            fonts: ['https://fontlib.s3.amazonaws.com/Ubuntu/UbuntuMono-Regular.ttf'],
        }),
    }),
    new Asset({
        id: 'font-sample-AzeretMono.svg',
        type: 'docs',
        render: () => renderFontSample({
            fontFamily: 'Azeret Mono',
            fonts: ['https://fontlib.s3.amazonaws.com/Azeret/AzeretMono-Regular.ttf'],
        }),
    }),
];