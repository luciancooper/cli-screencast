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
}

interface Options extends Dimensions, RenderOptions {
    theme: Theme<string>
}

function resolveContext({
    theme,
    fontSize = 16,
    lineHeight = 1.25,
    ...options
}: Options, duration = 0) {
    const context: RenderContext = {
        theme,
        fontSize,
        grid: [fontSize * 0.6, fontSize * lineHeight],
        duration,
    };
    return [context, options] as const;
}

export function renderCaptureSvg({ content, cursor, duration }: CaptureData, options: Options): string {
    const [context, windowOptions] = resolveContext(options, duration);
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window {...windowOptions}>
                {content.map(({ lines, ...keyFrame }, i) => <Frame key={i} lines={lines} keyFrame={keyFrame}/>)}
                {cursor.length > 0 && <CursorFrames frames={cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg({ lines, cursor }: ScreenData, options: Options): string {
    const [context, windowOptions] = resolveContext(options);
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window {...windowOptions}>
                <Frame lines={lines}/>
                {!cursor.hidden && <Cursor {...cursor}/>}
            </Window>
        </Context.Provider>,
    );
}