import { cloneElement } from 'react';
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
     * @defaultValue `fontSize * 0.125`
     */
    spread?: number | [rx: number, ry: number]

    /**
     * Blur radius of the box shadow. This is the standard deviation value for the Gaussian blur function.
     * @defaultValue `fontSize * 0.25`
     */
    blurRadius?: number

    /**
     * Color of the box shadow.
     * @defaultValue `rgba(0, 0, 0, 0.5)`
     */
    color?: RGBA | string
}

export default function createBoxShadow({
    dx,
    dy,
    spread,
    blurRadius,
    color,
}: Required<BoxShadowOptions>): [string, JSX.Element] | null {
    const primitives: JSX.Element[] = [];
    let props: { in?: 'SourceAlpha' } = { in: 'SourceAlpha' },
        pid = '';
    // add the dilate / erode primitives according to the spread radius
    const [sx, sy = sx] = typeof spread === 'number' ? [spread] : spread;
    if (sx || sy) {
        if ((sx < 0 && sy > 0) || (sx > 0 && sy < 0)) {
            // x & y spread radii are of opposite signs, must add both dilate and erode morphology primitives
            const ox = sx > 0 ? 'dilate' : 'erode',
                oy = sy > 0 ? 'dilate' : 'erode';
            pid += `${ox[0]}${Math.abs(sx)}${oy[0]}${Math.abs(sy)}`;
            primitives.push(
                <feMorphology key='morph-x' operator={ox} radius={`${Math.abs(sx)},0`} {...props}/>,
                <feMorphology key='morph-y' operator={oy} radius={`0,${Math.abs(sy)}`}/>,
            );
        } else {
            // x & y spread radii are not of opposite signs, one dilate or erode morphology primitive will suffice
            const operator = (sx || sy) > 0 ? 'dilate' : 'erode',
                radius = sx === sy ? [Math.abs(sx)] : [Math.abs(sx), Math.abs(sy)];
            pid += `${operator[0]}${radius.join('-')}`;
            primitives.push(<feMorphology key='morph' operator={operator} radius={radius.join(',')} {...props}/>);
        }
        props = {};
    }
    // add the offset filter primitive if dx or dy are not zero
    if (dx || dy) {
        primitives.push(<feOffset key='offset' dx={dx} dy={dy} {...props}/>);
        pid += (dx ? `x${dx}` : '') + (dy ? `y${dy}` : '');
        props = {};
    }
    // add the gaussian blur filter primitive if the blur radius is > 0
    if (blurRadius > 0) {
        primitives.push(<feGaussianBlur key='blur' stdDeviation={blurRadius} {...props}/>);
        pid += `b${blurRadius}`;
    }
    // stop if no filter primitives have been added
    if (!primitives.length) return null;
    // resolve shadow color
    const rgba = resolveColor(color),
        [hex, alpha] = [hexString(rgba), alphaValue(rgba, false)];
    // stop if box shadow color is transparent
    if (alpha === 0) return null;
    // set result of last filter primitive
    primitives[primitives.length - 1] = cloneElement(primitives[primitives.length - 1]!, { result: 'Shadow' });
    // construct filter id
    let id = `bs-${pid}-${hex.slice(1)}`;
    // add alpha to id if there is any transparency
    if (alpha < 1) id += ((1 << 8) + Math.round(alpha * 255)).toString(16).slice(-2);
    // add remaining filter primitives
    primitives.push(
        // create flood color
        <feFlood key='flood' floodColor={hex} floodOpacity={alpha}/>,
        // composite flood color with shadow alpha
        <feComposite key='composite' in2='Shadow' operator='in'/>,
        // overlay source graphic over the box shadow
        <feMerge key='merge'>
            <feMergeNode/>
            <feMergeNode in='SourceGraphic'/>
        </feMerge>,
    );
    // return id & filter jsx element
    return [id, (
        <filter key='box-shadow' id={id} filterUnits='userSpaceOnUse'>
            {primitives}
        </filter>
    )];
}