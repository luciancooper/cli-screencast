import { renderToStaticMarkup } from 'react-dom/server';
import type {
    RGBA, Dimensions, Title, ParsedCaptureData, ParsedScreenData, ParsedCaptureFrames, SVGData, SVGCaptureData,
} from '../types';
import type { Theme } from '../theme';
import Context, { type RenderContext } from './Context';
import Window from './Window';
import type { BoxShadowOptions } from './BoxShadow';
import Frame from './Frame';
import { Cursor, CursorFrames } from './Cursor';

export { defaultBoxShadow } from './BoxShadow';

export interface RenderOptions {
    /**
     * Theme specification
     */
    theme?: Partial<Theme>

    /**
     * @defaultValue `"'Monaco', 'Cascadia Code', 'Courier New'"`
     */
    fontFamily?: string

    /**
     * @defaultValue `12`
     */
    fontSize?: number

    /**
     * @defaultValue `1.2`
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

    /**
     * Border radius of the rendered window frame
     * @defaultValue `5`
     */
    borderRadius?: number

    /**
     * Render a box shadow around the window frame. A box shadow options object can be specified to customize
     * the shadow effect, or if set to `true`, the default box shadow effect will be rendered.
     * @defaultValue `false`
     */
    boxShadow?: boolean | BoxShadowOptions

    /**
     * Render top stoplight buttons
     * @defaultValue `true`
     */
    decorations?: boolean

    /**
     * Inset added to the top of the rendered window when `decorations` is true.
     * If `decorations` is `false`, this option is ignored
     * @defaultValue `40`
     */
    insetMajor?: number

    /**
     * Inset added to the left, right, and bottom of the rendered window frame
     * when `decorations` is true. If `decorations` is `false`, this option is ignored.
     * @defaultValue `20`
     */
    insetMinor?: number

    /**
     * Window horizontal padding
     * @defaultValue `5`
     */
    paddingX?: number

    /**
     * Window vertical padding
     * @defaultValue `5`
     */
    paddingY?: number

    /**
     * Window horizontal offset
     * @defaultValue `12`
     */
    offsetX?: number

    /**
     * Window vertical offset
     * @defaultValue `12`
     */
    offsetY?: number
}

interface RenderProps extends Required<RenderOptions> {
    theme: Theme<RGBA>
    boxShadow: false | Required<BoxShadowOptions>
    fontColumnWidth?: number | undefined
    css?: string | null
}

type RenderableData = Dimensions & { duration?: number } & (
    { frames?: { title: Title }[] } | { title?: Title | Title[] }
);

export function resolveContext({
    theme,
    fontFamily,
    fontSize,
    columnWidth,
    fontColumnWidth,
    lineHeight,
    iconColumnWidth,
    borderRadius,
    boxShadow,
    decorations,
    insetMajor,
    insetMinor,
    paddingX,
    paddingY,
    offsetX,
    offsetY,
}: Omit<RenderProps, 'css'>, {
    columns,
    rows,
    duration = 0,
    ...data
}: RenderableData): RenderContext {
    // calculate grid
    const [gx, gy] = [fontSize * (columnWidth ?? fontColumnWidth ?? 0.6), fontSize * lineHeight];
    // determine if data has title
    let titleInset = false;
    if ('frames' in data) {
        // ParsedCaptureFrames
        titleInset = data.frames.some(({ title }) => (!!title.icon || !!title.text));
    } else if ('title' in data) {
        // ParsedCaptureData / ParsedScreenData
        titleInset = Array.isArray(data.title) ? data.title.length > 0 : (!!data.title.icon || !!data.title.text);
    }
    // window top
    const top = decorations ? insetMajor : titleInset ? gy * 1.5 : 0,
        // window side
        side = decorations ? insetMinor : 0,
        // size of the terminal window
        window = {
            top,
            side,
            width: columns * gx + paddingX * 2 + side * 2,
            height: rows * gy + paddingY * 2 + side + top,
        },
        // size of the image (window size + offsets)
        size = {
            width: window.width + offsetX * 2,
            height: window.height + offsetY * 2,
        };
    // create context
    return {
        columns,
        rows,
        theme,
        fontFamily,
        fontSize,
        borderRadius,
        boxShadow,
        decorations,
        padding: [paddingX, paddingY],
        offset: [offsetX, offsetY],
        grid: [gx, gy],
        iconColumnWidth,
        duration,
        window,
        size,
    };
}

export function renderCaptureSvg(data: ParsedCaptureData, { css, ...props }: RenderProps): string {
    const context = resolveContext(props, data);
    return renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window css={css ?? null} title={data.title.length ? data.title : null}>
                {data.content.map(({ lines, ...keyFrame }, i) => (
                    <Frame key={i} lines={lines} keyFrame={keyFrame}/>
                ))}
                {data.cursor.length > 0 && <CursorFrames frames={data.cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg(data: ParsedScreenData, { css, ...props }: RenderProps): SVGData {
    const { lines, title, cursor } = data,
        context = resolveContext(props, data);
    return {
        ...context.size,
        svg: renderToStaticMarkup(
            <Context.Provider value={context}>
                <Window css={css ?? null} title={(title.icon || title.text) ? title : null}>
                    <Frame lines={lines}/>
                    {cursor ? <Cursor {...cursor}/> : null}
                </Window>
            </Context.Provider>,
        ),
    };
}

export function renderCaptureFrames(data: ParsedCaptureFrames, { css, ...props }: RenderProps): SVGCaptureData {
    const context = resolveContext(props, data),
        frames = [];
    for (const { time, endTime, ...frame } of data.frames) {
        // render svg frame
        const svg = renderToStaticMarkup(
            <Context.Provider value={context}>
                <Window css={css ?? null} title={(frame.title.icon || frame.title.text) ? frame.title : null}>
                    <Frame lines={frame.lines}/>
                    {frame.cursor ? <Cursor {...frame.cursor}/> : null}
                </Window>
            </Context.Provider>,
        );
        // push rendered frame
        frames.push({ time, endTime, svg });
    }
    return { ...context.size, frames };
}