import { renderToStaticMarkup } from 'react-dom/server';
import { useContext } from 'react';
import { applyDefRenderOptions, applyDefTerminalOptions } from '@src/options';
import { parseScreen } from '@src/parser';
import Context from '@src/render/Context';
import Window from '@src/render/Window';
import Frame from '@src/render/Frame';
import { Cursor } from '@src/render/Cursor';
import { resolveContext, type RenderOptions } from '@src/render';
import Asset, { embedFonts } from '../asset';

export function Grid({ color, thickness }: { color: string, thickness: number }) {
    const { columns: n, rows: m, grid: [dx, dy] } = useContext(Context),
        gridPath = [
            ...Array(m + 1).fill(0).map((_, i) => `M0,${i * dy}h${dx * n}`),
            ...Array(n + 1).fill(0).map((_, j) => `M${j * dx},0v${m * dy}`),
        ].join('');
    return <path stroke={color} fill='none' strokeWidth={thickness} strokeLinecap='square' d={gridPath}/>;
}

const renderOptions: RenderOptions = {
    theme: { cursorBlink: true, cursorType: 'underline' },
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
        font = await embedFonts(content, fontInfo),
        parsed = parseScreen({ ...applyDefTerminalOptions({ columns, rows: 1 }), content }),
        [context, windowOptions] = resolveContext({ ...applyDefRenderOptions(renderOptions), ...font }, parsed);
    // adjust offset x to standardize all font sample svg sizes
    windowOptions.offsetX += (context.fontSize * 0.65 - context.grid[0]) * columns / 2;
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window {...windowOptions}>
                <Frame lines={parsed.lines}/>
                {parsed.cursor ? <Cursor {...parsed.cursor}/> : null}
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