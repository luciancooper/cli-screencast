import type { FunctionComponent, SVGProps } from 'react';
import type { TextChunk, KeyFrame } from '../types';
import { expandStyleProps } from '../parser';
import { useRenderContext } from './Context';
import Text from './Text';
import { KeyFrameAnimation } from './Animation';

interface FrameProps extends SVGProps<SVGGElement> {
    lines: { chunks: TextChunk[] }[]
    keyFrame?: KeyFrame
}

const Frame: FunctionComponent<FrameProps> = ({ lines, keyFrame, ...svgProps }) => {
    const { duration } = useRenderContext();
    return (
        <g className='frame' dominantBaseline='central' {...svgProps}>
            {lines.flatMap(({ chunks }, i) => (
                chunks.map(({ str, x: [x, span], style: { props, ...style } }, j) => (
                    <Text key={`${i}:${j}`} x={x} y={i} span={span} {...style} {...expandStyleProps(props)}>
                        {str}
                    </Text>
                ))
            ))}
            {keyFrame ? <KeyFrameAnimation {...keyFrame} duration={duration}/> : null}
        </g>
    );
};

export default Frame;