import type { SVGProps, FunctionComponent } from 'react';
import { stringWidth, sliceColumns } from 'tty-strings';
import type { Title, KeyFrame, TextChunk } from '../types';
import { expandStyleProps } from '../parser';
import { useRenderContext } from './Context';
import Text from './Text';
import { KeyFrameAnimation } from './Animation';

function truncateTitle(chunks: TextChunk[], cols: number): readonly [chunks: TextChunk[], columns: number] {
    const truncated: TextChunk[] = [];
    let tcols = cols;
    for (const { str, x: [x, span], style } of chunks) {
        if (x + span < cols - 1) {
            truncated.push({ str, x: [x, span], style });
            continue;
        }
        const tstr = `${sliceColumns(str, 0, cols - x - 1)}…`,
            tspan = stringWidth(tstr);
        truncated.push({ str: tstr, x: [x, tspan], style });
        tcols = x + tspan;
        break;
    }
    return [truncated, tcols];
}

const WindowTitleFrame: FunctionComponent<{ title: Title, columnInset: number }> = ({ title, columnInset }) => {
    const { columns, grid: [dx, dy], iconColumnWidth } = useRenderContext();
    let iconX: number,
        textElement = null;
    if (title.columns) {
        const iconInset = title.icon ? Math.ceil(iconColumnWidth) + 1 : 0;
        let { chunks, columns: textSpan } = title;
        if (textSpan + iconInset > columns - columnInset) {
            [chunks, textSpan] = truncateTitle(chunks, columns - iconInset - columnInset);
        }
        iconX = Math.max(Math.floor((columns - textSpan - iconInset) / 2), columnInset);
        textElement = chunks.map(({ str, x: [x, span], style: { props, ...style } }, j) => (
            <Text key={j} x={iconX + iconInset + x} y={0} span={span} {...style} {...expandStyleProps(props)}>
                {str}
            </Text>
        ));
    } else {
        iconX = Math.floor((columns - Math.ceil(iconColumnWidth)) / 2);
    }
    const iconSize = Math.min(dx * iconColumnWidth, dy);
    return (
        <>
            {title.icon ? (
                <use
                    xlinkHref={`#${title.icon}`}
                    x={dx * (iconX + Math.ceil(iconColumnWidth) / 2) - iconSize / 2}
                    y={(dy - iconSize) / 2}
                    width={iconSize}
                    height={iconSize}
                />
            ) : null}
            {textElement}
        </>
    );
};

interface WindowTitleProps extends SVGProps<SVGGElement> {
    title: Title | KeyFrame<Title>[]
    columnInset: number
}

const WindowTitle: FunctionComponent<WindowTitleProps> = ({ columnInset, title, ...svgProps }) => {
    const { duration } = useRenderContext();
    let content: JSX.Element | JSX.Element[];
    if (Array.isArray(title)) {
        // check if keyframe array is empty
        if (!title.length) return null;
        // if one frame spans the entire capture, just render the content
        if (title.length === 1 && title[0]?.time === 0 && title[0].endTime === duration) {
            content = <WindowTitleFrame columnInset={columnInset} title={title[0]}/>;
        } else {
            // otherwise render as frames
            content = title.map(({ time, endTime, ...data }, i) => (
                <g key={i} className='title-frame'>
                    <WindowTitleFrame columnInset={columnInset} title={data}/>
                    <KeyFrameAnimation time={time} endTime={endTime} duration={duration}/>
                </g>
            ));
        }
    } else {
        content = <WindowTitleFrame columnInset={columnInset} title={title}/>;
    }
    return (
        <g className='window-title' dominantBaseline='central' {...svgProps}>
            {content}
        </g>
    );
};

export default WindowTitle;