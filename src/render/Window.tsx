import { useContext } from 'react';
import type { FunctionComponent } from 'react';
import type { Dimensions } from '../types';
import { toHex } from '../color';
import Context from './Context';

export interface WindowOptions {
    /**
     * Render top stoplight buttons
     * @defaultValue `true`
     */
    decorations?: boolean

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

const Window: FunctionComponent<Dimensions & WindowOptions> = ({
    columns,
    rows,
    decorations = true,
    paddingY = 5,
    paddingX = 5,
    children,
}) => {
    const theme = useContext(Context),
        width = columns * 10 + (paddingX + (decorations ? 20 : 0)) * 2,
        displayHeight = rows * theme.fontSize * theme.lineHeight,
        height = displayHeight * 10 + paddingY * 2 + (decorations ? 60 : 0);
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            width={width}
            height={height}
        >
            <rect
                className='window-background'
                width={width}
                height={height}
                rx={decorations ? 5 : 0}
                ry={decorations ? 5 : 0}
                fill={toHex(theme.background)}
            />
            {decorations && (
                <g className='window-decorations'>
                    <circle cx={20} cy={20} r={6} fill='#ff5f58'/>
                    <circle cx={40} cy={20} r={6} fill='#ffbd2e'/>
                    <circle cx={60} cy={20} r={6} fill='#18c132'/>
                </g>
            )}
            <svg
                xmlns='http://www.w3.org/2000/svg'
                xmlnsXlink='http://www.w3.org/1999/xlink'
                x={paddingX + (decorations ? 15 : 0)}
                y={paddingY + (decorations ? 50 : 0)}
                width={columns * 10}
                height={displayHeight * 10}
                viewBox={`0 0 ${columns} ${displayHeight}`}
                fontFamily={theme.fontFamily}
                fontSize={theme.fontSize}
            >
                {children}
            </svg>
        </svg>
    );
};

export default Window;