import type { FunctionComponent, SVGProps } from 'react';
import type { CursorLocation, CursorKeyFrame } from '../types';
import { hexString, alphaValue } from '../color';
import { useRenderContext } from './Context';
import { Animation, TransformAnimation, type KeyTime } from './Animation';

interface CursorProps extends SVGProps<SVGRectElement>, CursorLocation {}

export const Cursor: FunctionComponent<CursorProps> = ({
    line,
    column,
    children,
    ...props
}) => {
    const { theme: { cursorColor, cursorType, cursorBlink }, fontSize, grid: [dx, dy] } = useRenderContext(),
        w = (cursorType === 'beam' ? 0.15 : 1) * dx,
        lh = Math.min(dy, fontSize * 1.2),
        [cy, h] = cursorType === 'underline' ? [lh * 0.9, lh * 0.1] : [0, lh],
        y = line * dy + (dy - lh) / 2 + cy;
    return (
        <rect
            x={column * dx}
            y={y}
            width={w}
            height={h}
            fill={hexString(cursorColor)}
            fillOpacity={alphaValue(cursorColor, true)}
            {...props}
        >
            {cursorBlink ? (
                <Animation
                    attribute='opacity'
                    duration={1000}
                    keyTimes={[{ value: 1, time: 0 }, { value: 0, time: 500 }]}
                />
            ) : null}
            {children}
        </rect>
    );
};

export function opacityKeyTimes(frames: CursorKeyFrame[], duration: number) {
    // determine if the cursor hidden at some point
    const isHidden = frames.some(({ time, endTime }, i) => (
        (i === 0 && time > 0) || (endTime < (i === frames.length - 1 ? duration : frames[i + 1]!.time))
    ));
    if (!isHidden) return [];
    const times: KeyTime<number>[] = [];
    let last = 0;
    for (const { time, endTime } of frames) {
        if (time > last) times.push({ value: 0, time: last });
        if (time > last || last === 0) times.push({ value: 1, time });
        last = endTime;
    }
    if (last < duration) times.push({ value: 0, time: last });
    return times;
}

export function translateKeyTimes(frames: CursorKeyFrame[], [dx, dy]: [number, number]) {
    const keyTimes: KeyTime<string>[] = [],
        [first, ...subsequent] = frames as [CursorKeyFrame, ...CursorKeyFrame[]],
        [cy, cx] = [first.line, first.column];
    let [py, px] = [cy, cx];
    for (const { time, line, column } of subsequent) {
        // continue if cursor position does not change
        if (py === line && px === column) continue;
        // cursor position has changed, add a key frame
        keyTimes.push({
            value: [(column - cx) * dx, (line - cy) * dy].join(','),
            time,
        });
        [py, px] = [line, column];
    }
    if (keyTimes.length) keyTimes.unshift({ value: [0, 0].join(','), time: 0 });
    return keyTimes;
}

interface CursorFramesProps extends SVGProps<SVGRectElement> {
    frames: CursorKeyFrame[]
}

export const CursorFrames: FunctionComponent<CursorFramesProps> = ({ frames, ...props }) => {
    const { grid, duration } = useRenderContext(),
        first = frames[0]!,
        opacity = opacityKeyTimes(frames, duration),
        translate = translateKeyTimes(frames, grid),
        cursor = (
            <Cursor line={first.line} column={first.column} {...props}>
                {translate.length > 0 && (
                    <TransformAnimation keyTimes={translate} duration={duration}/>
                )}
            </Cursor>
        );
    // wrap cursor in a <g> element to prevent opacity animation conflicts when cursor blink is enabled
    return opacity.length > 0 ? (
        <g>
            {cursor}
            <Animation attribute='opacity' keyTimes={opacity} duration={duration}/>
        </g>
    ) : cursor;
};