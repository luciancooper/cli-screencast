import type { FunctionComponent, SVGProps } from 'react';
import type { Title, KeyFrame } from '../types';
import { hexString, alphaValue } from '../color';
import iconPaths from './icons.json';
import { useRenderContext } from './Context';
import createBoxShadow from './BoxShadow';
import WindowTitle from './WindowTitle';

interface WindowProps extends SVGProps<SVGSVGElement> {
    title?: Title | KeyFrame<Title>[] | null
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
    } = useRenderContext();
    // create title icon defs if needed
    let iconDefs: JSX.Element | null = null;
    // determine title icons used
    const iconIds = Array.isArray(title)
        ? [...new Set(title.map(({ icon }) => icon!).filter(Boolean))]
        : title?.icon ? [title.icon] : [];
    if (iconIds.length > 0) {
        // get icon color from theme
        const [fill, alpha] = [hexString(theme.iconColor), alphaValue(theme.iconColor, true)];
        iconDefs = (
            <defs>
                {iconIds.map((id) => (
                    <symbol key={id} id={id} viewBox='0 0 1 1' fill={fill} fillOpacity={alpha}>
                        <path d={iconPaths[id].path}/>
                    </symbol>
                ))}
            </defs>
        );
    }
    // calculate title inset
    const titleInset = decorations ? Math.ceil((50 - paddingX) / dx) : 0,
        // create box shadow
        [shadowId, shadowFilter] = (boxShadow && createBoxShadow(boxShadow)) || [null, null];
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            fontFamily={fontFamily}
            fontSize={fontSize}
            viewBox={`0 0 ${size.width} ${size.height}`}
            {...size}
            {...props}
        >
            <style dangerouslySetInnerHTML={{ __html: `text{white-space:pre}${css ?? ''}` }}/>
            {iconDefs}
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
                <WindowTitle
                    title={title}
                    columnInset={titleInset}
                    transform={`translate(${offsetX + paddingX + window.side},${offsetY + paddingY + (window.top - dy) / 2})`}
                />
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