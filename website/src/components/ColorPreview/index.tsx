import type { ComponentProps, CSSProperties } from 'react';
import clsx from 'clsx';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import styles from './styles.module.scss';

interface Props extends ComponentProps<'div'> {
    color?: string
}

const colorRegex = /^(?:\d+:\d+:\d+(?::\d*\.?\d+)?|(?:[a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{3}))$/i;

export default function ColorPreview({ children, color = '', ...props }: Props) {
    const brokenLinks = useBrokenLinks();
    // add broken link if color args are malformed
    if (!colorRegex.test(color)) {
        brokenLinks.collectLink(`color:${color}`);
        return children;
    }
    // parse the color
    let [r, g, b, a] = [0, 0, 0, 1];
    if (!color.includes(':')) {
        let hex = color.toLowerCase();
        if (hex.length === 8) [hex, a] = [hex.slice(0, -2), parseInt(hex.slice(-2), 16) / 255];
        if (hex.length === 3) hex = hex[0].repeat(2) + hex[1].repeat(2) + hex[2].repeat(2);
        [r, g, b] = [hex.slice(0, 2), hex.slice(2, -2), hex.slice(-2)].map((h) => parseInt(h, 16));
    } else {
        [r, g, b, a = 1] = color.split(':').map(Number) as [number, number, number, number?];
    }
    // add --swatch-color css variable to color the swatch background
    const style = { '--swatch-color': `rgba(${r},${g},${b},${a})` };
    // create hex value for title tooltip
    let title = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(-6)}`;
    if (a < 1) title += ((1 << 8) + Math.round(a * 255)).toString(16).slice(-2);
    // return the color preview
    return (
        <div {...props} className={clsx(styles.colorPreview, props.className)} style={style as CSSProperties}>
            <span className={clsx(styles.swatch, { [styles.swatchAlpha]: a < 1 })} title={title}/>
            {children}
        </div>
    );
}