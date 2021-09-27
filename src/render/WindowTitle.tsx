import { useContext } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import { stringWidth, sliceColumns } from 'tty-strings';
import type { Title, RecordingFrame } from '../types';
import Context from './Context';
import { Animation } from './Animation';

interface WindowTitleProps extends Title, SVGProps<SVGGElement> {
    columnInset: number
    keyFrame?: RecordingFrame
}

const WindowTitle: FunctionComponent<WindowTitleProps> = ({
    columnInset,
    icon,
    text,
    keyFrame,
    ...props
}) => {
    const {
        columns,
        theme,
        grid: [dx, dy],
        duration,
        iconSpan,
    } = useContext(Context);
    let iconX,
        textElement = null;
    if (text) {
        const iconInset = icon ? Math.ceil(iconSpan) + 1 : 0;
        let [title, textSpan] = [text, stringWidth(text)];
        if (textSpan + iconInset > columns - columnInset) {
            title = `${sliceColumns(title, 0, columns - iconInset - columnInset - 1)}…`;
            textSpan = stringWidth(title);
        }
        iconX = Math.max(Math.floor((columns - textSpan - iconInset) / 2), columnInset);
        textElement = (
            <text
                x={(iconX + iconInset) * dx}
                y={dy / 2}
                fill={theme.text}
                dominantBaseline='central'
                style={{ whiteSpace: 'pre' }}
            >
                {title}
            </text>
        );
    } else {
        iconX = Math.floor((columns - Math.ceil(iconSpan)) / 2);
    }
    const iconSize = Math.min(dx * iconSpan, dy);
    return (
        <g className='title-frame' {...props}>
            {icon && (
                <use
                    xlinkHref={`#${icon}`}
                    x={(iconX + (Math.ceil(iconSpan) - iconSpan) / 2) * dx + (dx * iconSpan - iconSize) / 2}
                    y={(dy - iconSize) / 2}
                    width={iconSize}
                    height={iconSize}
                    fill={theme.iconColor}
                />
            )}
            {textElement}
            {keyFrame && (
                <Animation
                    attribute='opacity'
                    duration={duration}
                    keyFrames={[
                        { value: 0, time: 0 },
                        { value: 1, time: keyFrame.time / duration },
                        { value: 0, time: keyFrame.endTime / duration },
                    ]}
                />
            )}
        </g>
    );
};

export default WindowTitle;