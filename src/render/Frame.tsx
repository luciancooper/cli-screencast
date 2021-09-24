import { useContext } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import type { TerminalLine, RecordingFrame } from '../types';
import { expandProps } from '../ansi';
import Context from './Context';
import Text from './Text';
import { Animation } from './Animation';

interface FrameProps extends SVGProps<SVGGElement> {
    lines: TerminalLine[]
    keyFrame?: RecordingFrame
}

const Frame: FunctionComponent<FrameProps> = ({ lines, keyFrame, ...svgProps }) => {
    const { grid: [, dy], duration } = useContext(Context);
    return (
        <g className='frame' {...svgProps}>
            {lines.map(({ chunks }, i) => {
                const y = i * dy;
                return (
                    <g key={`row:${i}`} className='row' transform={`translate(0, ${y})`}>
                        {chunks.map(({ str, x: [x, span], style: { props, ...style } }, j) => (
                            <Text key={j} x={x} span={span} {...style} {...expandProps(props)}>{str}</Text>
                        ))}
                    </g>
                );
            })}
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

export default Frame;