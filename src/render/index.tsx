import { renderToStaticMarkup } from 'react-dom/server';
import type {
    Dimensions,
    CaptureData,
    ScreenData,
    Size,
    SVGData,
    CaptureFrame,
    SVGCaptureData,
} from '../types';
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
            <Window {...windowOptions} title={data.title.length ? data.title : null}>
                {data.content.map(({ lines, ...keyFrame }, i) => (
                    <Frame key={i} lines={lines} keyFrame={keyFrame}/>
                ))}
                {data.cursor.length > 0 && <CursorFrames frames={data.cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg({ lines, cursor, title }: ScreenData, options: RenderProps): SVGData {
    const [context, windowOptions] = resolveContext(options);
    let size = { width: NaN, height: NaN };
    const svg = renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window ref={(s) => { size = s!; }} {...windowOptions} title={(title.icon || title.text) ? title : null}>
                <Frame lines={lines}/>
                {!cursor.hidden ? <Cursor {...cursor}/> : null}
            </Window>
        </Context.Provider>,
    );
    return { ...size, svg };
}

export function renderCaptureFrames(captureFrames: CaptureFrame[], options: RenderProps): SVGCaptureData {
    const [context, windowOptions] = resolveContext(options),
        hasTitle = captureFrames.some(({ screen }) => (!!screen.title.icon || !!screen.title.text)),
        frames = [];
    let size = { width: 0, height: 0 };
    const sizeRef = (s: Size | null) => {
        size = {
            width: Math.max(size.width, s!.width),
            height: Math.max(size.height, s!.height),
        };
    };
    for (const { screen: { lines, cursor, title }, ...time } of captureFrames) {
        // render svg frame
        const svg = renderToStaticMarkup(
            <Context.Provider value={context}>
                <Window
                    ref={sizeRef}
                    title={(title.icon || title.text) ? title : null}
                    forceTitleInset={hasTitle}
                    {...windowOptions}
                >
                    <Frame lines={lines}/>
                    {!cursor.hidden ? <Cursor {...cursor}/> : null}
                </Window>
            </Context.Provider>,
        );
        // push rendered frame
        frames.push({ ...time, svg });
    }
    return { ...size, frames };
}