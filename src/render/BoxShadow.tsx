import { cloneElement, type FunctionComponent } from 'react';
import type { RGBA } from '../types';
import { resolveColor, hexString, alphaValue } from '../color';

export interface BoxShadowOptions {
    /**
     * The horizontal offset of the box shadow. Positive values will offset the shadow to the right, while negative
     * values will offset the shadow to the left.
     * @defaultValue `0`
     */
    dx?: number

    /**
     * The vertical offset of the box shadow. Positive values will offset the shadow down, while negative values will
     * offset the shadow up.
     * @defaultValue `0`
     */
    dy?: number

    /**
     * The spread radius of the box shadow. If two numbers are specified, the first number will represent the x-radius
     * of the spread and the second will represent the y-radius. If one number is specified, it is used for both the
     * x and y radii. Positive values will cause the shadow to expand, and negative values will cause the shadow
     * to contract.
     * @defaultValue `2`
     */
    spread?: number | [number, number]

    /**
     * Blur radius of the box shadow. This is the standard deviation value for the Gaussian blur function.
     * @defaultValue `4`
     */
    blurRadius?: number

    /**
     * Color of the box shadow.
     * @defaultValue `rgba(0, 0, 0, 0.5)`
     */
    color?: RGBA | string
}

export const defaultBoxShadow: Required<BoxShadowOptions> = {
    dx: 0,
    dy: 0,
    spread: 2,
    blurRadius: 4,
    color: [0, 0, 0, 0.5],
};

const BoxShadow: FunctionComponent<{ id: string } & Required<BoxShadowOptions>> = ({
    id,
    dx,
    dy,
    spread,
    blurRadius,
    color,
}) => {
    const primitives: JSX.Element[] = [];
    let props: { in?: 'SourceAlpha' } = { in: 'SourceAlpha' };
    // add the dilate / erode primitives according to the spread radius
    const [sx, sy = sx] = typeof spread === 'number' ? [spread] : spread;
    if (sx || sy) {
        if ((sx < 0 && sy > 0) || (sx > 0 && sy < 0)) {
            // x & y spread radii are of opposite signs, must add both dilate and erode morphology primitives
            primitives.push(
                <feMorphology
                    key='morph-x'
                    operator={sx > 0 ? 'dilate' : 'erode'}
                    radius={`${Math.abs(sx)},0`}
                    {...props}
                />,
                <feMorphology
                    key='morph-y'
                    operator={sy > 0 ? 'dilate' : 'erode'}
                    radius={`0,${Math.abs(sy)}`}
                />,
            );
        } else {
            // x & y spread radii are not of opposite signs, one dilate or erode morphology primitive will suffice
            primitives.push(
                <feMorphology
                    key='morph'
                    operator={(sx || sy) > 0 ? 'dilate' : 'erode'}
                    radius={sx === sy ? Math.abs(sx) : `${Math.abs(sx)},${Math.abs(sy)}`}
                    {...props}
                />,
            );
        }
        props = {};
    }
    // add the offset filter primitive if dx or dy are not zero
    if (dx || dy) {
        primitives.push(<feOffset key='offset' dx={dx} dy={dy} {...props}/>);
        props = {};
    }
    // add the gaussian blur filter primitive if the blur radius is > 0
    if (blurRadius > 0) {
        primitives.push(<feGaussianBlur key='blur' stdDeviation={blurRadius} {...props}/>);
        props = {};
    }
    // stop if no filter primitives have been added
    if (!primitives.length) return null;
    // set result of last filter primitive
    primitives[primitives.length - 1] = cloneElement(primitives[primitives.length - 1]!, { result: 'Shadow' });
    // resolve shadow color
    const rgba = resolveColor(color);
    // add remaining filter primitives
    primitives.push(
        // create flood color
        <feFlood key='flood' floodColor={hexString(rgba)} floodOpacity={alphaValue(rgba, false)}/>,
        // composite flood color with shadow alpha
        <feComposite key='composite' in2='Shadow' operator='in'/>,
        // overlay source graphic over the box shadow
        <feMerge key='merge'>
            <feMergeNode/>
            <feMergeNode in='SourceGraphic'/>
        </feMerge>,
    );
    // return filter element
    return <filter id={id} filterUnits='userSpaceOnUse'>{primitives}</filter>;
};

export default BoxShadow;