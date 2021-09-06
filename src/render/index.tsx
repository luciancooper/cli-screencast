import { renderToStaticMarkup } from 'react-dom/server';
import type { Dimensions, CaptureData, ScreenData } from '../types';
import type { Theme } from '../theme';
import Context from './Context';
import Window, { WindowOptions } from './Window';
import Frame from './Frame';
import { Cursor, CursorFrames } from './Cursor';

interface Options extends Dimensions, WindowOptions {
    theme: Theme
}

export function renderCaptureSvg({ content, cursor, duration }: CaptureData, { theme, ...options }: Options): string {
    return renderToStaticMarkup(
        <Context.Provider value={theme}>
            <Window {...options}>
                {content.map(({ lines, time, endTime }, i) => (
                    <Frame key={i} lines={lines} keyFrame={{ time, endTime, duration }}/>
                ))}
                {cursor.length > 0 && <CursorFrames frames={cursor} duration={duration}/>}
            </Window>
        </Context.Provider>,
    );
}

export function renderScreenSvg({ lines, cursor }: ScreenData, { theme, ...options }: Options): string {
    return renderToStaticMarkup(
        <Context.Provider value={theme}>
            <Window {...options}>
                <Frame lines={lines}/>
                {!cursor.hidden && <Cursor {...cursor}/>}
            </Window>
        </Context.Provider>,
    );
}

export type { WindowOptions };