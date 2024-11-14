import type { FunctionComponent } from 'react';
import type { OmitStrict, KeyFrame } from '../types';

export interface KeyTime<T> {
    value: T
    time: number
}

interface AnimationProps {
    /**
     * Attribute to animate
     */
    attribute: string
    /**
     * Array of key time pairs, each time value must be in ms
     */
    keyTimes: KeyTime<string | number>[]
    /**
     * Duration of the animation in ms
     */
    duration: number
}

export const Animation: FunctionComponent<AnimationProps> = ({
    attribute,
    keyTimes,
    duration,
    ...props
}) => (
    <animate
        attributeName={attribute}
        dur={`${(duration % 60000) / 1000}s`}
        values={keyTimes.map(({ value }) => value).join(';')}
        keyTimes={keyTimes.map(({ time }) => time / duration).join(';')}
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
    keyTimes,
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
        values={keyTimes.map(({ value }) => value).join(';')}
        keyTimes={keyTimes.map(({ time }) => time / duration).join(';')}
        {...props}
    />
);

export const KeyFrameAnimation: FunctionComponent<KeyFrame & { duration: number }> = ({ time, endTime, duration }) => {
    const keyTimes: KeyTime<number>[] = [{ value: 1, time }];
    if (time > 0) keyTimes.unshift({ value: 0, time: 0 });
    if (endTime < duration) keyTimes.push({ value: 0, time: endTime });
    return <Animation attribute='opacity' keyTimes={keyTimes} duration={duration}/>;
};