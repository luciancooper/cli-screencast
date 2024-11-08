import type { SVGProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyDefaults } from '@src/options';
import Asset from '../asset';
import TerminalIcon from './icons/Terminal';

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

interface Props {
    size: number
    window?: { width?: number, aspectRatio?: number, borderRadius?: number }
    colors?: { window?: string, icon?: string }
    decorations?: boolean | DecorationsProps
}

const defWindowProps: Required<Required<Props>['window']> = {
    width: 1,
    aspectRatio: 14 / 17,
    borderRadius: 1 / 16,
};

const defColorProps: Required<Required<Props>['colors']> = {
    window: '#282a36',
    icon: '#ffffff',
};

export function ProjectLogo({
    size,
    window,
    colors,
    decorations = true,
    ...opts
}: Props & SVGProps<SVGElement>) {
    const { width, aspectRatio, borderRadius } = applyDefaults(defWindowProps, window ?? {}),
        { window: windowColor, icon: iconColor } = applyDefaults(defColorProps, colors ?? {}),
        [w, h] = [width * size, width * aspectRatio * size],
        radius = borderRadius * size,
        [ix, iy] = [(size - w) / 2, (size - h) / 2],
        iconSize = Math.min(w, h),
        iconOffset = (size - iconSize) / 2;
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            viewBox={`0 0 ${size} ${size}`}
            {...opts}
        >
            <defs>
                <TerminalIcon id='terminal-icon'/>
            </defs>
            <rect x={ix} y={iy} width={w} height={h} rx={radius} ry={radius} fill={windowColor}/>
            {decorations ? (
                <Decorations
                    transform={`translate(${ix},${iy})`}
                    viewSize={size}
                    {...(decorations === true ? {} : decorations)}
                />
            ) : null}
            <use
                xlinkHref='#terminal-icon'
                x={iconOffset}
                y={iconOffset}
                width={iconSize}
                height={iconSize}
                fill={iconColor}
            />
        </svg>
    );
}

export default [
    new Asset({
        id: 'project-logo.svg',
        type: 'static',
        path: 'assets',
        render: () => renderToStaticMarkup(
            <ProjectLogo size={128}/>,
        ),
    }),
    new Asset({
        id: 'project-logo-dark.svg',
        type: 'static',
        path: 'assets',
        render: () => renderToStaticMarkup(
            <ProjectLogo
                size={128}
                colors={{ window: '#eff1f5', icon: defColorProps.window }}
                decorations={{ colors: ['#b30900', '#cc8b00', '#0b5b17'] }}
            />,
        ),
    }),
];