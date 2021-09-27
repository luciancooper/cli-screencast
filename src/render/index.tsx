import { renderToStaticMarkup } from 'react-dom/server';
import type { Dimensions, CaptureData, ScreenData } from '../types';
import type { Theme } from '../theme';
import Context, { RenderContext } from './Context';
import Window, { WindowOptions } from './Window';
import Frame from './Frame';
import { Cursor, CursorFrames } from './Cursor';

export interface RenderOptions extends WindowOptions {
    /**
     * @defaultValue `16`
     */
    fontSize?: number

    /**
     * @defaultValue `1.25`
     */
    lineHeight?: number

    /**
     * @defaultValue `1.6`
     */
    iconColumnWidth?: number
}

interface Options extends Dimensions, RenderOptions {
    theme: Theme<string>
}

function resolveContext({
    columns,
    rows,
    theme,
    fontSize = 16,
    lineHeight = 1.25,
    iconColumnWidth = 1.6,
    ...options
}: Options, duration = 0) {
    const context: RenderContext = {
        columns,
        rows,
        theme,
        fontSize,
        grid: [fontSize * 0.6, fontSize * lineHeight],
        iconSpan: iconColumnWidth,
        duration,
    };
    return [context, options] as const;
}

export function renderCaptureSvg(data: CaptureData, options: Options): string {
    const [context, windowOptions] = resolveContext(options, data.duration);
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window {...windowOptions} title={data.title.length ? data.title : null}>
                {data.content.map(({ lines, ...keyFrame }, i) => <Frame key={i} lines={lines} keyFrame={keyFrame}/>)}
                {data.cursor.length > 0 && <CursorFrames frames={data.cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg({ lines, cursor, title }: ScreenData, options: Options): string {
    const [context, windowOptions] = resolveContext(options);
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window {...windowOptions} title={(title.icon || title.text) ? title : null}>
                <Frame lines={lines}/>
                {!cursor.hidden && <Cursor {...cursor}/>}
            </Window>
        </Context.Provider>,
    );
}