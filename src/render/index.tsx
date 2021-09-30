import { renderToStaticMarkup } from 'react-dom/server';
import type { Dimensions, CaptureData, ScreenData, SVGData } from '../types';
import type { Theme } from '../theme';
import Context, { RenderContext } from './Context';
import Window, { WindowOptions } from './Window';

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
            <Window
                {...windowOptions}
                content={data.content}
                cursor={data.cursor.length > 0 ? data.cursor : null}
                title={data.title.length ? data.title : null}
            />
        </Context.Provider>,
    );
}

export function renderScreenSvg({ lines, cursor, title }: ScreenData, options: Options): SVGData {
    const [context, windowOptions] = resolveContext(options);
    let size = { width: NaN, height: NaN };
    const svg = renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window
                ref={(s) => { size = s!; }}
                {...windowOptions}
                content={{ lines }}
                cursor={cursor}
                title={(title.icon || title.text) ? title : null}
            />
        </Context.Provider>,
    );
    return { ...size, svg };
}