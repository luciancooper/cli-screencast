import { renderToStaticMarkup } from 'react-dom/server';
import type {
    Dimensions,
    CaptureData,
    ScreenData,
    Size,
    SVGData,
    CaptureKeyFrame,
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

export interface RenderProps extends Dimensions, Required<RenderOptions> {
    theme: Theme<string>
    css?: string | null
}

function resolveContext({
    columns,
    rows,
    theme,
    fontSize,
    lineHeight,
    iconColumnWidth,
    ...windowOptions
}: RenderProps, duration = 0) {
    const context: RenderContext = {
        columns,
        rows,
        theme,
        fontSize,
        grid: [fontSize * 0.6, fontSize * lineHeight],
        iconColumnWidth,
        duration,
    };
    return [context, windowOptions] as const;
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

export function renderScreenSvg(data: ScreenData, options: RenderProps): SVGData {
    const { lines, title, cursor } = data,
        [context, windowOptions] = resolveContext(options);
    let size = { width: NaN, height: NaN };
    const svg = renderToStaticMarkup(
        <Context.Provider value={context}>
            <Window ref={(s) => { size = s!; }} {...windowOptions} title={(title.icon || title.text) ? title : null}>
                <Frame lines={lines}/>
                {cursor && <Cursor {...cursor}/>}
            </Window>
        </Context.Provider>,
    );
    return { ...size, svg };
}

export function renderCaptureFrames(captureFrames: CaptureKeyFrame[], options: RenderProps): SVGCaptureData {
    const [context, windowOptions] = resolveContext(options),
        hasTitle = captureFrames.some(({ title }) => (!!title.icon || !!title.text)),
        frames = [];
    let size = { width: 0, height: 0 };
    const sizeRef = (s: Size | null) => {
        size = {
            width: Math.max(size.width, s!.width),
            height: Math.max(size.height, s!.height),
        };
    };
    for (const { time, endTime, ...frame } of captureFrames) {
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
                    {frame.cursor && <Cursor {...frame.cursor}/>}
                </Window>
            </Context.Provider>,
        );
        // push rendered frame
        frames.push({ time, endTime, svg });
    }
    return { ...size, frames };
}