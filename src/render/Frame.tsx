import { useContext, type FunctionComponent, type SVGProps } from 'react';
import type { TerminalLine, KeyFrame } from '../types';
import { expandAnsiProps } from '../parser';
import Context from './Context';
import Text from './Text';
import { Animation } from './Animation';

interface FrameProps extends SVGProps<SVGGElement> {
    lines: TerminalLine[]
    keyFrame?: KeyFrame
}

const Frame: FunctionComponent<FrameProps> = ({ lines, keyFrame, ...svgProps }) => {
    const { duration } = useContext(Context);
    return (
        <g className='frame' dominantBaseline='central' {...svgProps}>
            {lines.flatMap(({ chunks }, i) => (
                chunks.map(({ str, x: [x, span], style: { props, ...style } }, j) => (
                    <Text key={`${i}:${j}`} x={x} y={i} span={span} {...style} {...expandAnsiProps(props)}>
                        {str}
                    </Text>
                ))
            ))}
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

export default Frame;