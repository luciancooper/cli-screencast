import { renderToStaticMarkup } from 'react-dom/server';
import type {
    RGBA, Dimensions, ParsedCaptureData, ParsedScreenData, ParsedCaptureFrames, Size, SVGData, SVGCaptureData,
} from '../types';
import type { Theme } from '../theme';
import Context, { type RenderContext } from './Context';
import Window, { type WindowOptions } from './Window';
import type { BoxShadowOptions } from './BoxShadow';
import Frame from './Frame';
import { Cursor, CursorFrames } from './Cursor';

export { defaultBoxShadow } from './BoxShadow';

export interface RenderOptions extends WindowOptions {
    /**
     * Theme specification
     */
    theme?: Partial<Theme>

    /**
     * @defaultValue `16`
     */
    fontSize?: number

    /**
     * @defaultValue `1.25`
     */
    lineHeight?: number

    /**
     * @defaultValue `undefined`
     */
    columnWidth?: number | undefined

    /**
     * @defaultValue `1.6`
     */
    iconColumnWidth?: number
}

interface RenderProps extends Required<RenderOptions> {
    theme: Theme<RGBA>
    boxShadow: false | Required<BoxShadowOptions>
    fontFamily?: string
    fontColumnWidth?: number | undefined
    css?: string | null
}

export function resolveContext({
    theme,
    fontSize,
    columnWidth,
    fontColumnWidth,
    lineHeight,
    iconColumnWidth,
    ...windowOptions
}: RenderProps, { columns, rows, duration = 0 }: Dimensions & { duration?: number }) {
    const context: RenderContext = {
        columns,
        rows,
        theme,
        fontSize,
        grid: [fontSize * (columnWidth ?? fontColumnWidth ?? 0.6), fontSize * lineHeight],
        iconColumnWidth,
        duration,
    };
    return [context, windowOptions] as const;
}

export function renderCaptureSvg(data: ParsedCaptureData, options: RenderProps): string {
    const [context, windowOptions] = resolveContext(options, data);
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window {...windowOptions} title={data.title.length ? data.title : null}>
                {data.content.map(({ lines, ...keyFrame }, i) => (
                    <Frame key={i} lines={lines} keyFrame={keyFrame}/>
                ))}
                {data.cursor.length > 0 && <CursorFrames frames={data.cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg(data: ParsedScreenData, options: RenderProps): SVGData {
    const { lines, title, cursor } = data,
        [context, windowOptions] = resolveContext(options, data);
    let size = { width: NaN, height: NaN };
    const svg = renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window ref={(s) => { size = s!; }} {...windowOptions} title={(title.icon || title.text) ? title : null}>
                <Frame lines={lines}/>
                {cursor ? <Cursor {...cursor}/> : null}
            </Window>
        </Context.Provider>,
    );
    return { ...size, svg };
}

export function renderCaptureFrames(data: ParsedCaptureFrames, options: RenderProps): SVGCaptureData {
    const [context, windowOptions] = resolveContext(options, data),
        hasTitle = data.frames.some(({ title }) => (!!title.icon || !!title.text)),
        frames = [];
    let size = { width: 0, height: 0 };
    const sizeRef = (s: Size | null) => {
        size = {
            width: Math.max(size.width, s!.width),
            height: Math.max(size.height, s!.height),
        };
    };
    for (const { time, endTime, ...frame } of data.frames) {
        // render svg frame
        const svg = renderToStaticMarkup(
            <Context.Provider value={context}>
                <Window
                    ref={sizeRef}
                    title={(frame.title.icon || frame.title.text) ? frame.title : null}
                    forceTitleInset={hasTitle}
                    {...windowOptions}
                >
                    <Frame lines={frame.lines}/>
                    {frame.cursor ? <Cursor {...frame.cursor}/> : null}
                </Window>
            </Context.Provider>,
        );
        // push rendered frame
        frames.push({ time, endTime, svg });
    }
    return { ...size, frames };
}