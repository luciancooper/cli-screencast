import { useContext } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import type { CursorRecordingFrame } from '../types';
import { invert } from '../color';
import Context from './Context';
import { Animation, TransformAnimation, KeyTime } from './Animation';

interface CursorProps extends SVGProps<SVGRectElement> {
    line: number
    column: number
}

export const Cursor: FunctionComponent<CursorProps> = ({
    line,
    column,
    children,
    ...props
}: CursorProps) => {
    const theme = useContext(Context),
        displayHeight = theme.fontSize * theme.lineHeight;
    return (
        <rect
            x={column}
            y={line * displayHeight}
            width={0.15}
            height={displayHeight}
            fill={invert(theme.background)}
            {...props}
        >
            {children}
        </rect>
    );
};

export function opacityKeyTimes(frames: CursorRecordingFrame[], duration: number) {
    // check if the cursor hidden at some point
    if (!frames.some(({ hidden }) => hidden)) return [];
    const times: KeyTime<number>[] = [],
        [first, ...subsequent] = frames;
    let value = Number(!first!.hidden);
    times.push({ value, time: first!.time / duration });
    for (const { time, hidden } of subsequent) {
        if (value === Number(!hidden)) continue;
        value ^= 1;
        times.push({ value, time: time / duration });
    }
    return times;
}

export function translateKeyTimes(frames: CursorRecordingFrame[], duration: number, [dy, dx] = [1, 1]) {
    const times: KeyTime<string>[] = [],
        [first, ...subsequent] = frames.filter(({ hidden }) => !hidden),
        [cy, cx] = [first!.line, first!.column];
    let [py, px] = [cy, cx];
    for (const { time, line, column } of subsequent) {
        if (py === line && px === column) continue;
        times.push({
            value: [(column - cx) * dx, (line - cy) * dy].join(','),
            time: time / duration,
        });
        [py, px] = [line, column];
    }
    if (times.length) times.unshift({ value: [0, 0].join(','), time: 0 });
    return times;
}

interface CursorFramesProps extends SVGProps<SVGRectElement> {
    frames: CursorRecordingFrame[]
    duration: number
}

export const CursorFrames: FunctionComponent<CursorFramesProps> = ({ frames, duration, ...props }) => {
    const theme = useContext(Context),
        first = frames.find(({ hidden }) => !hidden)!,
        opacity = opacityKeyTimes(frames, duration),
        translate = translateKeyTimes(frames, duration, [theme.fontSize * theme.lineHeight, 1]);
    return (
        <Cursor line={first.line} column={first.column} {...props}>
            {opacity.length > 0 && (
                <Animation attribute='opacity' keyFrames={opacity} duration={duration}/>
            )}
            {translate.length > 0 && (
                <TransformAnimation keyFrames={translate} duration={duration}/>
            )}
        </Cursor>
    );
};