import { useContext } from 'react';
import type { FunctionComponent } from 'react';
import type { Dimensions } from '../types';
import Context from './Context';

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

interface WindowProps extends Dimensions, WindowOptions {}

const Window: FunctionComponent<WindowProps> = ({
    columns,
    rows,
    borderRadius = 5,
    decorations = true,
    insetMajor = 40,
    insetMinor = 20,
    paddingY = 5,
    paddingX = 5,
    children,
}) => {
    const { theme, fontSize, grid: [dx, dy] } = useContext(Context);
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            width={columns * dx + paddingX * 2 + (decorations ? insetMinor * 2 : 0)}
            height={rows * dy + paddingY * 2 + (decorations ? insetMajor + insetMinor : 0)}
            fontFamily={theme.fontFamily}
            fontSize={fontSize}
        >
            <rect
                className='window-background'
                width='100%'
                height='100%'
                rx={borderRadius}
                ry={borderRadius}
                fill={theme.background}
            />
            {decorations && (
                <g className='window-decorations'>
                    <circle cx={insetMinor} cy={insetMajor / 2} r={6} fill='#ff5f58'/>
                    <circle cx={insetMinor + 20} cy={insetMajor / 2} r={6} fill='#ffbd2e'/>
                    <circle cx={insetMinor + 40} cy={insetMajor / 2} r={6} fill='#18c132'/>
                </g>
            )}
            <svg
                x={paddingX + (decorations ? insetMinor : 0)}
                y={paddingY + (decorations ? insetMajor : 0)}
                width={columns * dx}
                height={rows * dy}
            >
                {children}
            </svg>
        </svg>
    );
};

export default Window;