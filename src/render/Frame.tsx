import { useContext } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import type { TerminalLine } from '../types';
import Context from './Context';
import Text from './Text';
import { Animation } from './Animation';

export interface KeyFrame {
    time: number
    endTime: number
    duration: number
}

interface FrameProps {
    lines: TerminalLine[]
    keyFrame?: KeyFrame
}

const Frame: FunctionComponent<FrameProps & SVGProps<SVGGElement>> = ({ lines, keyFrame, ...props }) => {
    const theme = useContext(Context);
    return (
        <g className='frame' {...props}>
            {lines.map(({ chunks }, i) => {
                const y = i * theme.fontSize * theme.lineHeight;
                return (
                    <g key={`row:${i}`} className='row' transform={`translate(0, ${y})`}>
                        {chunks.map(({ str, x: [x, span], style }, j) => (
                            <Text key={j} x={x} span={span} {...style}>{str}</Text>
                        ))}
                    </g>
                );
            })}
            {keyFrame && (
                <Animation
                    attribute='opacity'
                    duration={keyFrame.duration}
                    keyFrames={[
                        { value: 0, time: 0 },
                        { value: 1, time: keyFrame.time / keyFrame.duration },
                        { value: 0, time: keyFrame.endTime / keyFrame.duration },
                    ]}
                />
            )}
        </g>
    );
};

export default Frame;