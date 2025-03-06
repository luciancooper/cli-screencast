import type { FunctionComponent, SVGProps } from 'react';
import type { CursorLocation, CursorState, KeyFrame } from '../types';
import { hexString, alphaValue } from '../color';
import { processCursorFrames } from '../frames';
import { useRenderContext } from './Context';
import { Animation, TransformAnimation, type KeyTime } from './Animation';

interface CursorProps extends CursorLocation, SVGProps<SVGRectElement> {
    animateBlink?: boolean
}

export const Cursor: FunctionComponent<CursorProps> = ({
    line,
    column,
    animateBlink = false,
    children,
    ...props
}) => {
    const { theme: { cursorColor, cursorStyle, cursorBlink }, fontSize, grid: [dx, dy] } = useRenderContext(),
        w = (cursorStyle === 'beam' ? 0.15 : 1) * dx,
        lh = Math.min(dy, fontSize * 1.2),
        [cy, h] = cursorStyle === 'underline' ? [lh * 0.9, lh * 0.1] : [0, lh],
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
            {(animateBlink && cursorBlink) ? (
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

export const CursorFrames: FunctionComponent<{ frames: KeyFrame<CursorState>[] }> = ({ frames }) => {
    const { grid: [dx, dy], duration, theme: { cursorBlink } } = useRenderContext(),
        // process cursor frames, incorporating cursor blink animation if enabled
        extracted = processCursorFrames(frames, cursorBlink);
    // filter to only visible frames
    let visibleFrames = extracted.filter((frame) => frame.visible);
    // stop if cursor is never visible
    if (!visibleFrames.length) return null;
    // initial position of the cursor
    let line: number,
        column: number;
    // extract cursor movement key frames for each moment that the cursor's position changes while it's visible
    const translate: KeyTime<string>[] = [];
    {
        // separate out first visible cursor
        [{ line, column }, ...visibleFrames] = visibleFrames as [CursorLocation, ...KeyFrame<CursorState>[]];
        // loop through all subsequent visible frames, looking for times where cursor moves
        let prev: CursorLocation = { line, column };
        for (const frame of visibleFrames) {
            // continue if cursor position does not change
            if (prev.line === frame.line && prev.column === frame.column) continue;
            // cursor position has changed, add a translation key frame
            translate.push({
                value: [(frame.column - column) * dx, (frame.line - line) * dy].join(','),
                time: frame.time,
            });
            prev = frame;
        }
        // add initial key frame if there are any translation key frames
        if (translate.length) translate.unshift({ value: [0, 0].join(','), time: 0 });
    }
    let opacity: KeyTime<number>[] | null = null;
    // if cursor is not visible at some point, we need an opacity animation
    if (extracted.some(({ visible }) => !visible)) {
        // determine opacity key times for each moment that the cursor's visibility changes
        const [first, ...subsequent] = extracted as [KeyFrame<CursorState>, ...KeyFrame<CursorState>[]];
        // add initial key frame with first frame's opacity value
        let value = Number(first.visible);
        opacity = [{ value, time: first.time }];
        // loop through all subsequent frames
        for (const { time, visible } of subsequent) {
            // continue if visible status does not change
            if (Number(visible) === value) continue;
            // change in visible status, add an opacity key frame
            value ^= 1;
            opacity.push({ value, time });
        }
    }
    return (
        <Cursor line={line} column={column}>
            {translate.length ? <TransformAnimation keyTimes={translate} duration={duration}/> : null}
            {opacity ? <Animation attribute='opacity' keyTimes={opacity} duration={duration}/> : null}
        </Cursor>
    );
};