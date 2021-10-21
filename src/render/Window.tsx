import { useContext, forwardRef, SVGProps } from 'react';
import type { IconID, Size, Title, TitleKeyFrame } from '../types';
import iconPaths from './icons.json';
import Context from './Context';
import WindowTitle from './WindowTitle';

export interface WindowOptions {
    /**
     * Border radius of the rendered window frame
     * @defaultValue `5`
     */
    borderRadius?: number

    /**
     * Render top stoplight buttons
     * @defaultValue `true`
     */
    decorations?: boolean

    /**
     * Inset added to the top of the rendered window when `decorations` is true.
     * If `decorations` is `false`, this option is ignored
     * @defaultValue `40`
     */
    insetMajor?: number

    /**
     * Inset added to the left, right, and bottom of the rendered window frame
     * when `decorations` is true. If `decorations` is `false`, this option is ignored.
     * @defaultValue `20`
     */
    insetMinor?: number

    /**
     * Window horizontal padding
     * @defaultValue `5`
     */
    paddingX?: number

    /**
     * Window vertical padding
     * @defaultValue `5`
     */
    paddingY?: number
}

interface WindowProps extends Required<WindowOptions>, SVGProps<SVGSVGElement> {
    title?: Title | TitleKeyFrame[] | null
    forceTitleInset?: boolean
}

const Window = forwardRef<Size, WindowProps>(({
    children,
    title = null,
    forceTitleInset = false,
    borderRadius,
    decorations,
    insetMajor,
    insetMinor,
    paddingY,
    paddingX,
}, ref) => {
    const {
            columns,
            rows,
            theme,
            fontSize,
            grid: [dx, dy],
        } = useContext(Context),
        icons = Array.isArray(title)
            ? [...new Set(title.map(({ icon }) => icon).filter(Boolean) as IconID[])]
            : title?.icon ? [title.icon] : [],
        top = decorations ? insetMajor : (title || forceTitleInset) ? dy + paddingY * 2 : 0,
        side = decorations ? insetMinor : 0,
        titleInset = decorations ? Math.ceil((50 - paddingX) / dx) : 0,
        size = {
            width: columns * dx + paddingX * 2 + side * 2,
            height: rows * dy + paddingY * 2 + side + top,
        };
    // set ref value
    if (typeof ref === 'function') ref(size);
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            fontFamily={theme.fontFamily}
            fontSize={fontSize}
            {...size}
        >
            <style dangerouslySetInnerHTML={{ __html: 'text{white-space:pre}' }}/>
            {icons.length > 0 && (
                <defs>
                    {icons.map((id) => (
                        <symbol key={id} id={id} viewBox='0 0 1 1'>
                            <path d={iconPaths[id].path}/>
                        </symbol>
                    ))}
                </defs>
            )}
            <rect
                className='window-background'
                width='100%'
                height='100%'
                rx={borderRadius}
                ry={borderRadius}
                fill={theme.background}
            />
            {title && (
                <svg
                    className='window-title'
                    x={paddingX + side}
                    y={paddingY + (top - paddingY * 2 - dy) / 2}
                    width={columns * dx}
                    height={dy}
                >
                    {Array.isArray(title) ? title.map(({ time, endTime, ...data }, i) => (
                        <WindowTitle key={i} columnInset={titleInset} title={data} keyFrame={{ time, endTime }}/>
                    )) : (
                        <WindowTitle title={title} columnInset={titleInset}/>
                    )}
                </svg>
            )}
            {decorations && (
                <g className='window-decorations'>
                    <circle cx={insetMinor} cy={insetMajor / 2} r={6} fill='#ff5f58'/>
                    <circle cx={insetMinor + 20} cy={insetMajor / 2} r={6} fill='#ffbd2e'/>
                    <circle cx={insetMinor + 40} cy={insetMajor / 2} r={6} fill='#18c132'/>
                </g>
            )}
            <svg
                className='terminal-content'
                x={paddingX + side}
                y={paddingY + top}
                width={columns * dx}
                height={rows * dy}
            >
                {children}
            </svg>
        </svg>
    );
});

export default Window;