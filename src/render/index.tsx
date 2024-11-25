import { renderToStaticMarkup } from 'react-dom/server';
import type { RGBA, Dimensions, Title, ParsedCaptureData, ParsedScreenData, SVGFrameData } from '../types';
import type { Theme } from '../theme';
import { extractCaptureFrames } from '../frames';
import Context, { type RenderContext } from './Context';
import Window from './Window';
import type { BoxShadowOptions } from './BoxShadow';
import Frame from './Frame';
import { Cursor, CursorFrames } from './Cursor';

export type { BoxShadowOptions };

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
     * @defaultValue `fontSize * 0.25`
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
     * @defaultValue `fontSize * 2.5`
     */
    insetMajor?: number

    /**
     * Inset added to the left, right, and bottom of the rendered window frame
     * when `decorations` is true. If `decorations` is `false`, this option is ignored.
     * @defaultValue `fontSize * 1.25`
     */
    insetMinor?: number

    /**
     * Window horizontal padding
     * @defaultValue `fontSize * 0.25`
     */
    paddingX?: number

    /**
     * Window vertical padding
     * @defaultValue `fontSize * 0.25`
     */
    paddingY?: number

    /**
     * Window horizontal offset
     * @defaultValue `fontSize * 0.75`
     */
    offsetX?: number

    /**
     * Window vertical offset
     * @defaultValue `fontSize * 0.75`
     */
    offsetY?: number
}

interface RenderProps extends Required<Omit<RenderOptions, 'boxShadow'>> {
    theme: Theme<RGBA>
    boxShadow: Required<BoxShadowOptions> | null
    fontColumnWidth?: number | undefined
    css?: string | null
}

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
    title,
}: Dimensions & { duration?: number, title?: Title | Title[] | null }): RenderContext {
    // calculate grid
    const [gx, gy] = [fontSize * (columnWidth ?? fontColumnWidth ?? 0.6), fontSize * lineHeight],
        // determine if data has title ParsedCaptureData / ParsedScreenData
        titleInset = title ? (!Array.isArray(title) || title.length > 0) : false,
        // window top
        top = decorations ? insetMajor : titleInset ? gy * 1.5 : 0,
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
            <Window css={css ?? null} title={data.title}>
                {data.content.map(({ lines, ...keyFrame }, i) => (
                    <Frame key={i} lines={lines} keyFrame={keyFrame}/>
                ))}
                {data.cursor.length > 0 && <CursorFrames frames={data.cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg(data: ParsedScreenData, { css, ...props }: RenderProps): string {
    const { lines, title, cursor } = data;
    return renderToStaticMarkup(
        <Context.Provider value={resolveContext(props, data)}>
            <Window css={css ?? null} title={title}>
                <Frame lines={lines}/>
                {cursor ? <Cursor animateBlink {...cursor}/> : null}
            </Window>
        </Context.Provider>,
    );
}

export function renderCaptureFrames(data: ParsedCaptureData, { css, ...props }: RenderProps): SVGFrameData {
    const context = resolveContext(props, data),
        frames: Extract<SVGFrameData, { frames: any }>['frames'] = [];
    for (const { time, endTime, ...frame } of extractCaptureFrames(data, context.theme.cursorBlink)) {
        // render and add svg frame
        frames.push({
            time,
            endTime,
            frame: renderToStaticMarkup(
                <Context.Provider value={context}>
                    <Window css={css ?? null} title={frame.title}>
                        <Frame lines={frame.lines}/>
                        {frame.cursor ? <Cursor {...frame.cursor}/> : null}
                    </Window>
                </Context.Provider>,
            ),
        });
    }
    return { ...context.size, frames };
}

export function renderScreenFrames(data: ParsedScreenData, { css, ...props }: RenderProps): SVGFrameData {
    const { lines, title, cursor } = data,
        context = resolveContext(props, data),
        frame = renderToStaticMarkup(
            <Context.Provider value={context}>
                <Window css={css ?? null} title={title}>
                    <Frame lines={lines}/>
                    {cursor ? <Cursor {...cursor}/> : null}
                </Window>
            </Context.Provider>,
        );
    return {
        ...context.size,
        ...((cursor && context.theme.cursorBlink) ? {
            // add additional frame for blinking cursor
            frames: [{ time: 0, endTime: 500, frame }, {
                time: 500,
                endTime: 1000,
                frame: renderToStaticMarkup(
                    <Context.Provider value={context}>
                        <Window css={css ?? null} title={title}>
                            <Frame lines={lines}/>
                        </Window>
                    </Context.Provider>,
                ),
            }],
        } : { frame }),
    };
}