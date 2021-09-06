import type { FunctionComponent } from 'react';
import type { OmitStrict } from '../types';

export interface KeyTime<T> {
    value: T
    time: number
}

interface AnimationProps {
    attribute: string
    keyFrames: KeyTime<string | number>[]
    duration: number
}

export const Animation: FunctionComponent<AnimationProps> = ({
    attribute,
    keyFrames,
    duration,
    ...props
}) => (
    <animate
        attributeName={attribute}
        dur={`${(duration % 60000) / 1000}s`}
        values={keyFrames.map(({ value }) => value).join(';')}
        keyTimes={keyFrames.map(({ time }) => time).join(';')}
        repeatCount='indefinite'
        calcMode='discrete'
        {...props}
    />
);

interface TransformAnimationProps extends OmitStrict<AnimationProps, 'attribute'> {
    type?: 'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY'
}

export const TransformAnimation: FunctionComponent<TransformAnimationProps> = ({
    type,
    keyFrames,
    duration,
    ...props
}) => (
    <animateTransform
        attributeName='transform'
        attributeType='XML'
        type={type}
        repeatCount='indefinite'
        calcMode='discrete'
        dur={`${(duration % 60000) / 1000}s`}
        values={keyFrames.map(({ value }) => value).join(';')}
        keyTimes={keyFrames.map(({ time }) => time).join(';')}
        {...props}
    />
);