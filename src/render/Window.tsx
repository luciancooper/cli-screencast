import type { FunctionComponent, SVGProps } from 'react';
import type { IconID, Title, TitleKeyFrame } from '../types';
import { hexString, alphaValue } from '../color';
import iconPaths from './icons.json';
import { useRenderContext } from './Context';
import createBoxShadow from './BoxShadow';
import WindowTitle from './WindowTitle';

interface WindowProps extends SVGProps<SVGSVGElement> {
    title?: Title | TitleKeyFrame[] | null
    css?: string | null
}

const Window: FunctionComponent<WindowProps> = (({
    children,
    title = null,
    css,
    ...props
}) => {
    const {
            columns,
            rows,
            theme,
            fontSize,
            fontFamily,
            borderRadius,
            boxShadow,
            decorations,
            padding: [paddingX, paddingY],
            offset: [offsetX, offsetY],
            grid: [dx, dy],
            window,
            size,
        } = useRenderContext(),
        icons = Array.isArray(title)
            ? [...new Set(title.map(({ icon }) => icon).filter(Boolean) as IconID[])]
            : title?.icon ? [title.icon] : [],
        // calculate title inset
        titleInset = decorations ? Math.ceil((50 - paddingX) / dx) : 0,
        // create box shadow
        [shadowId, shadowFilter] = (boxShadow && createBoxShadow(boxShadow)) || [null, null];
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            fontFamily={fontFamily}
            fontSize={fontSize}
            {...size}
            {...props}
        >
            <style dangerouslySetInnerHTML={{ __html: `text{white-space:pre}${css ?? ''}` }}/>
            {icons.length > 0 && (
                <defs>
                    {icons.map((id) => (
                        <symbol key={id} id={id} viewBox='0 0 1 1'>
                            <path d={iconPaths[id].path}/>
                        </symbol>
                    ))}
                </defs>
            )}
            {shadowFilter}
            <rect
                className='window-background'
                x={offsetX}
                y={offsetY}
                width={window.width}
                height={window.height}
                rx={borderRadius}
                ry={borderRadius}
                fill={hexString(theme.background)}
                fillOpacity={alphaValue(theme.background, true)}
                filter={shadowId ? `url(#${shadowId})` : undefined}
            />
            {title ? (
                <svg
                    className='window-title'
                    x={offsetX + paddingX + window.side}
                    y={offsetY + paddingY + (window.top - dy) / 2}
                    width={columns * dx}
                    height={dy}
                >
                    {Array.isArray(title) ? title.map(({ time, endTime, ...data }, i) => (
                        <WindowTitle key={i} columnInset={titleInset} title={data} keyFrame={{ time, endTime }}/>
                    )) : (
                        <WindowTitle title={title} columnInset={titleInset}/>
                    )}
                </svg>
            ) : null}
            {decorations ? (
                <g transform={`translate(${offsetX + paddingX + window.side * 0.4},${offsetY + paddingY + window.top * 0.2})`}>
                    <circle cx={6} cy={6} r={6} fill='#ff5f58'/>
                    <circle cx={26} cy={6} r={6} fill='#ffbd2e'/>
                    <circle cx={46} cy={6} r={6} fill='#18c132'/>
                </g>
            ) : null}
            <svg
                className='terminal-content'
                x={offsetX + paddingX + window.side}
                y={offsetY + paddingY + window.top}
                width={columns * dx}
                height={rows * dy}
            >
                {children}
            </svg>
        </svg>
    );
});

export default Window;