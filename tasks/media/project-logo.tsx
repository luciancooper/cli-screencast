import type { SVGProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PickOptional } from '@src/types';
import { applyDefaults } from '@src/options';
import { writeToFile } from '@src/utils';
import log from '@src/logger';

interface DecorationsProps extends SVGProps<SVGGElement> {
    diameter?: number
    spacing?: number
    inset?: number | [dx: number, dy: number]
    colors?: [c1: string, c2: string, c3: string]
}

function Decorations({
    viewSize,
    diameter = 7 / 128,
    spacing = 4.5 / 128,
    inset = 6 / 128,
    // eslint-disable-next-line react/no-object-type-as-default-prop
    colors: [c1, c2, c3] = ['#ff5f58', '#ffbd2e', '#18c132'],
    ...props
}: DecorationsProps & { viewSize: number }) {
    const [r, sx] = [(diameter * viewSize) / 2, spacing * viewSize],
        [ix, iy] = typeof inset === 'number' ? [inset, inset] : inset,
        [dx, dy] = [ix * viewSize, iy * viewSize];
    return (
        <g {...props}>
            <circle cx={dx + r} cy={dy + r} r={r} fill={c1}/>
            <circle cx={dx + r * 3 + sx} cy={dy + r} r={r} fill={c2}/>
            <circle cx={dx + r * 5 + sx * 2} cy={dy + r} r={r} fill={c3}/>
        </g>
    );
}

const iconPath = 'M0.4786 0.5307'
    + 'c-0.0464 0.0739 -0.1086 0.1366 -0.1821 0.1836'
    + 'c-0.0239 0.0148 -0.0539 0.0156 -0.0785 0.0021'
    + 's-0.04 -0.0393 -0.0404 -0.0674'
    + 's0.0145 -0.0542 0.0389 -0.0682'
    + 'c0.0381 -0.024 0.0719 -0.0541 0.1 -0.0893'
    + 'c-0.0288 -0.0343 -0.0625 -0.0641 -0.1 -0.0886'
    + 'c-0.0371 -0.0221 -0.0492 -0.0701 -0.0271 -0.1071'
    + 's0.0701 -0.0492 0.1071 -0.0271'
    + 'c0.0734 0.0466 0.1356 0.1088 0.1821 0.1821'
    + 'c0.0147 0.0246 0.0147 0.0554 0 0.08z'
    + 'M0.7571 0.7143'
    + 'h-0.1929'
    + 'c-0.0357 0 -0.0643 -0.0182 -0.0643 -0.0536'
    + 's0.0289 -0.0536 0.0643 -0.0536h0.1929'
    + 'c0.0357 0 0.0643 0.0182 0.0643 0.0536'
    + 's-0.0289 0.0536 -0.0643 0.0536z';

interface Props {
    size: number
    window?: { width?: number, aspectRatio?: number, borderRadius?: number }
    color?: { window?: string, icon?: string }
    decorations?: boolean | DecorationsProps
}

const defProps = {
    window: { width: 1, aspectRatio: 14 / 17, borderRadius: 1 / 16 },
    color: { window: '#282a36', icon: '#ffffff' },
    decorations: true,
} satisfies Required<PickOptional<Props>>;

export function ProjectLogo({ size, ...opts }: Props) {
    const { decorations, ...props } = applyDefaults<Required<PickOptional<Props>>>(defProps, opts),
        window = applyDefaults(defProps.window, props.window),
        color = applyDefaults(defProps.color, props.color),
        [w, h] = [window.width * size, window.width * window.aspectRatio * size],
        radius = window.borderRadius * size,
        [ix, iy] = [(size - w) / 2, (size - h) / 2],
        iconSize = Math.min(w, h),
        iconOffset = (size - iconSize) / 2;
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            viewBox={`0 0 ${size} ${size}`}
        >
            <defs>
                <symbol id='icon' viewBox='0 0 1 1'>
                    <path d={iconPath} fill={color.icon}/>
                </symbol>
            </defs>
            <rect x={ix} y={iy} width={w} height={h} rx={radius} ry={radius} fill={color.window}/>
            {decorations ? (
                <Decorations
                    transform={`translate(${ix},${iy})`}
                    viewSize={size}
                    {...(decorations === true ? {} : decorations)}
                />
            ) : null}
            <use xlinkHref='#icon' x={iconOffset} y={iconOffset} width={iconSize} height={iconSize}/>
        </svg>
    );
}

export default async function render(filePath: string, darkMode: boolean) {
    log.info('rendering %s mode project logo', darkMode ? 'dark' : 'light');
    // options specific to dark / light mode
    const opts: Partial<Props> = darkMode ? {
        color: { window: '#eff1f5', icon: defProps.color.window },
        decorations: { colors: ['#b30900', '#cc8b00', '#0b5b17'] },
    } : {};
    // render svg and save to file
    await writeToFile(filePath, renderToStaticMarkup(
        <ProjectLogo size={128} {...opts}/>,
    ));
    log.info('wrote %s mode project logo to %S', darkMode ? 'dark' : 'light', filePath);
}