import { useContext, type FunctionComponent } from 'react';
import { stringWidth, sliceColumns } from 'tty-strings';
import type { Title, KeyFrame, TextChunk } from '../types';
import { expandProps } from '../ansi';
import Context from './Context';
import Text from './Text';
import { Animation } from './Animation';

interface WindowTitleProps {
    title: Title
    columnInset: number
    keyFrame?: KeyFrame
}

function truncateTitle(chunks: TextChunk[], cols: number): readonly [TextChunk[], number] {
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

const WindowTitle: FunctionComponent<WindowTitleProps> = ({ columnInset, title, keyFrame }) => {
    const {
        columns,
        theme,
        grid: [dx, dy],
        duration,
        iconColumnWidth,
    } = useContext(Context);
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
            <Text key={j} x={iconX + iconInset + x} y={0} span={span} {...style} {...expandProps(props)}>{str}</Text>
        ));
    } else {
        iconX = Math.floor((columns - Math.ceil(iconColumnWidth)) / 2);
    }
    const iconSize = Math.min(dx * iconColumnWidth, dy);
    return (
        <g className='title-frame' dominantBaseline='central'>
            {title.icon ? (
                <use
                    xlinkHref={`#${title.icon}`}
                    x={dx * (iconX + Math.ceil(iconColumnWidth) / 2) - iconSize / 2}
                    y={(dy - iconSize) / 2}
                    width={iconSize}
                    height={iconSize}
                    fill={theme.iconColor}
                />
            ) : null}
            {textElement}
            {keyFrame ? (
                <Animation
                    attribute='opacity'
                    duration={duration}
                    keyFrames={[
                        { value: 0, time: 0 },
                        { value: 1, time: keyFrame.time / duration },
                        { value: 0, time: keyFrame.endTime / duration },
                    ]}
                />
            ) : null}
        </g>
    );
};

export default WindowTitle;