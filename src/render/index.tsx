import { renderToStaticMarkup } from 'react-dom/server';
import type { Dimensions, CaptureData, ScreenData, SVGData, CaptureFrame, SVGCaptureData } from '../types';
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

export interface RenderProps extends Dimensions, RenderOptions {
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
}: RenderProps, duration = 0) {
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

export function renderCaptureSvg(data: CaptureData, options: RenderProps): string {
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

export function renderScreenSvg({ lines, cursor, title }: ScreenData, options: RenderProps): SVGData {
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

export function renderCaptureFrames(captureFrames: CaptureFrame[], options: RenderProps): SVGCaptureData {
    const [context, windowOptions] = resolveContext(options),
        hasTitle = captureFrames.some(({ screen }) => (!!screen.title.icon || !!screen.title.text)),
        frames = [];
    let size = { width: 0, height: 0 };
    for (const { screen: { lines, cursor, title }, ...time } of captureFrames) {
        // render svg frame
        const svg = renderToStaticMarkup(
            <Context.Provider value={context}>
                <Window
                    ref={(s) => {
                        size = {
                            width: Math.max(size.width, s!.width),
                            height: Math.max(size.height, s!.height),
                        };
                    }}
                    {...windowOptions}
                    content={{ lines }}
                    cursor={cursor}
                    title={(title.icon || title.text) ? title : null}
                    forceTitleInset={hasTitle}
                />
            </Context.Provider>,
        );
        // push rendered frame
        frames.push({ ...time, svg });
    }
    return { ...size, frames };
}