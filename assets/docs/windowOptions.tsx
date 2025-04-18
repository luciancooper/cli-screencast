import { renderToStaticMarkup } from 'react-dom/server';
import type { FunctionComponent } from 'react';
import type { TerminalOptions, OutputOptions } from '@src/types';
import { applyDefRenderOptions, applyDefTerminalOptions } from '@src/options';
import { resolveTitle } from '@src/parser/title';
import Context from '@src/render/Context';
import Window from '@src/render/Window';
import { resolveContext, type RenderOptions } from '@src/render';
import Asset, { embedFonts } from '../asset';

type DiagramLabelProps = {
    text: string
    coords: [x: number, y: number]
    size: [w: number, h: number]
    line: {
        angle: number // [0, 360]
        distance: number // distance between label and arrow point
        curvature: number | [c1: number, c2: number] // [-1, 1]
    }
    position?: number
    textPosition?: number
    color?: string
} & ({
    kind: 'rect'
    side: 'left' | 'right' | 'top' | 'bottom'
} | {
    kind: 'bar'
    direction: 'horizontal' | 'vertical'
    barPosition?: number
    tick?: number
});

const DiagramLabel: FunctionComponent<DiagramLabelProps & { grid: readonly [gw: number, gh: number] }> = ({
    text,
    coords: [x, y],
    size: [w, h],
    grid: [gw, gh],
    position = 0.5,
    line: { angle, distance, curvature },
    textPosition = 0,
    color = '#eb3459',
    ...props
}) => {
    let shape: JSX.Element,
        px: number,
        py: number;
    if (props.kind === 'bar') {
        const { barPosition = 0.5, tick = 2 } = props;
        let d: string;
        if (props.direction === 'horizontal') {
            const ly = y + position * h;
            d = `M${x},${ly}H${x + w}M${x},${ly - tick}V${ly + tick}M${x + w},${ly - tick}V${ly + tick}`;
            [px, py] = [x + barPosition * w, ly];
        } else {
            const lx = x + position * w;
            d = `M${lx},${y}V${y + h}M${lx - tick},${y}H${lx + tick}M${lx - tick},${y + h}H${lx + tick}`;
            [px, py] = [lx, y + barPosition * h];
        }
        shape = <path d={d}/>;
    } else {
        shape = <rect x={x} y={y} width={w} height={h}/>;
        px = props.side === 'left' ? x : props.side === 'right' ? x + w : x + position * w;
        py = props.side === 'top' ? y : props.side === 'bottom' ? y + h : y + position * h;
    }
    const radian = angle * (Math.PI / 180),
        [cos, sin] = [Math.cos(radian), Math.sin(radian)],
        [dx, dy] = [distance * cos, distance * -sin],
        [ex, ey] = [px + dx, py + dy],
        // find curvature point
        [c1, c2] = typeof curvature === 'number' ? [curvature, curvature] : curvature,
        // find first curvature point
        [cx1, cy1] = c1 < 0 ? [ex, py] : [px, ey],
        [b1x, b1y] = [px + (cx1 - px) * Math.abs(c1), py + (cy1 - py) * Math.abs(c1)],
        // find second curvature point
        [cx2, cy2] = c2 < 0 ? [ex, py] : [px, ey],
        [b2x, b2y] = [ex + (cx2 - ex) * Math.abs(c2), ey + (cy2 - ey) * Math.abs(c2)],
        // create arrow path
        d = `M${px},${py}C${b1x},${b1y} ${b2x},${b2y} ${ex},${ey}`,
        // text box horizontal padding
        pad_x = 3,
        // text box width
        tw = gw * text.length + 2 * pad_x,
        // text position
        tx = ex - (cos < 0 ? tw : 0) + (textPosition < 0 ? textPosition * tw * Math.sign(cos) : 0),
        ty = ey - (sin > 0 ? gh : 0) + (textPosition > 0 ? textPosition * gh * Math.sign(sin) : 0);
    return (
        <g className='label'>
            <g stroke={color} fill='none'>
                {shape}
                <path d={d}/>
            </g>
            <rect x={tx} y={ty} width={tw} height={gh} fill='#EFF1F2' rx={2}/>
            <text x={tx + tw / 2} y={ty + gh / 2 + 1} fill='#000' textAnchor='middle' dominantBaseline='central'>
                {text}
            </text>
        </g>
    );
};

interface DiagramOptions extends Partial<TerminalOptions>, Omit<RenderOptions, 'fontFamily'>, Pick<OutputOptions, 'scaleFactor'> {
    insets: [ix: number, iy: number]
    labelFontSize: number
    labelLineHeight: number
}

async function WindowOptionsDiagram({
    scaleFactor = 1.25,
    insets: [ix, iy],
    labelFontSize,
    labelLineHeight,
    ...options
}: DiagramOptions) {
    const termProps = applyDefTerminalOptions({ columns: 50, rows: 10, ...options }, { cursorHidden: true }),
        title = resolveTitle(termProps.windowTitle, termProps.windowIcon),
        { css, ...windowFont } = await embedFonts({ title, lines: [] }, Asset.fonts.cascadiaCode),
        context = resolveContext({ ...applyDefRenderOptions(options), ...windowFont }, { ...termProps, title }),
        {
            padding: [paddingX, paddingY],
            offset: [offsetX, offsetY],
            grid: [dx, dy],
            fontSize,
            window,
        } = context,
        [cw, ch] = [context.columns * dx, context.rows * dy],
        labels: DiagramLabelProps[] = [{
            // top side padding
            text: 'paddingY',
            kind: 'bar',
            direction: 'vertical',
            coords: [offsetX + paddingX + window.side, offsetY],
            size: [cw, paddingY],
            position: 0.8,
            line: { angle: 310, distance: 32, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // top side offset
            text: 'offsetY',
            kind: 'bar',
            direction: 'vertical',
            coords: [offsetX + paddingX + window.side, 0],
            size: [cw, offsetY],
            position: 0.85,
            line: { angle: 330, distance: 38, curvature: [-0.8, -0.3] },
            textPosition: -0.2,
        }, {
            // bottom side padding
            text: 'paddingY',
            kind: 'bar',
            direction: 'vertical',
            coords: [offsetX + paddingX + window.side, offsetY + window.height - paddingY],
            size: [cw, paddingY],
            position: 0.75,
            line: { angle: 60, distance: 32, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // bottom side offset
            text: 'offsetY',
            kind: 'bar',
            direction: 'vertical',
            coords: [offsetX + paddingX + window.side, offsetY + window.height],
            size: [cw, offsetY],
            position: 0.8,
            line: { angle: 30, distance: 37, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // left side padding
            text: 'paddingX',
            kind: 'bar',
            direction: 'horizontal',
            coords: [offsetX, offsetY + paddingY + window.top],
            size: [paddingX, ch],
            line: { angle: 330, distance: 35, curvature: [0.7, 0.6] },
            textPosition: 0.5,
        }, {
            // left side offset
            text: 'offsetX',
            kind: 'bar',
            direction: 'horizontal',
            coords: [0, offsetY + paddingY + window.top],
            size: [offsetX, ch],
            position: 0.57,
            line: { angle: 325, distance: 60, curvature: [0.8, 0.3] },
            textPosition: 0.5,
        }, {
            // right side padding
            text: 'paddingX',
            kind: 'bar',
            direction: 'horizontal',
            coords: [offsetX + window.width - paddingX, offsetY + paddingY + window.top],
            size: [paddingX, ch],
            line: { angle: 210, distance: 35, curvature: [0.7, 0.6] },
            textPosition: 0.5,
        }, {
            // right side offset
            text: 'offsetX',
            kind: 'bar',
            direction: 'horizontal',
            coords: [offsetX + window.width, offsetY + paddingY + window.top],
            size: [offsetX, ch],
            position: 0.57,
            line: { angle: 215, distance: 60, curvature: [0.8, 0.3] },
            textPosition: 0.5,
        }];
    // Decoration Insets
    if (context.decorations) {
        labels.push({
            // top side inset
            text: 'insetMajor',
            kind: 'bar',
            direction: 'vertical',
            coords: [offsetX + paddingX + window.side, offsetY + paddingY],
            size: [cw, window.top],
            position: 0.75,
            barPosition: 0.75,
            line: { angle: 315, distance: 30, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // left side inset
            text: 'insetMinor',
            kind: 'bar',
            direction: 'horizontal',
            coords: [offsetX + paddingX, offsetY + paddingY + window.top],
            size: [window.side, ch],
            position: 0.45,
            barPosition: 0.75,
            line: { angle: 45, distance: 25, curvature: [0.3, 0.8] },
            textPosition: 0.5,
        }, {
            // right side inset
            text: 'insetMinor',
            kind: 'bar',
            direction: 'horizontal',
            coords: [offsetX + paddingX + cw + window.side, offsetY + paddingY + window.top],
            size: [window.side, ch],
            position: 0.45,
            barPosition: 0.25,
            line: { angle: 135, distance: 25, curvature: [0.3, 0.8] },
            textPosition: 0.5,
        }, {
            // bottom side inset
            text: 'insetMinor',
            kind: 'bar',
            direction: 'vertical',
            coords: [offsetX + paddingX + window.side, offsetY + ch + paddingY + window.top],
            size: [cw, window.side],
            position: 0.7,
            barPosition: 0.25,
            line: { angle: 135, distance: 20, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            text: 'decorations',
            kind: 'rect',
            side: 'bottom',
            coords: [offsetX + paddingX + window.side * 0.4, offsetY + paddingY + window.top * 0.2],
            size: [fontSize * (13 / 4), fontSize * (3 / 4)],
            line: { angle: 300, distance: 40, curvature: [0.8, 0.3] },
            textPosition: 0.5,
        });
    }
    // title labels
    if (title) {
        const columnInset = context.decorations ? Math.ceil((50 - paddingX) / dx) : 0,
            [tx, ty] = [offsetX + paddingX + window.side, offsetY + paddingY + (window.top - dy) / 2];
        let iconX: number;
        if (title.columns) {
            const iconInset = title.icon ? Math.ceil(context.iconColumnWidth) + 1 : 0;
            let { columns: textSpan } = title;
            if (textSpan + iconInset > context.columns - columnInset) {
                textSpan = context.columns - iconInset - columnInset;
            }
            iconX = Math.max(Math.floor((context.columns - textSpan - iconInset) / 2), columnInset);
            labels.push({
                text: 'windowTitle',
                kind: 'rect',
                side: 'bottom',
                coords: [tx + (iconX + iconInset) * dx, ty],
                size: [textSpan * dx, dy],
                line: { angle: 300, distance: 28, curvature: [0.5, -0.5] },
                textPosition: -0.25,
            });
        } else {
            iconX = Math.floor((context.columns - Math.ceil(context.iconColumnWidth)) / 2);
        }
        if (title.icon) {
            const iconSize = Math.min(dx * context.iconColumnWidth, dy);
            labels.push({
                text: 'windowIcon',
                kind: 'rect',
                side: 'bottom',
                coords: [
                    tx + dx * (iconX + Math.ceil(context.iconColumnWidth) / 2) - iconSize / 2,
                    ty + (dy - iconSize) / 2,
                ],
                size: [iconSize, iconSize],
                line: { angle: 240, distance: 30, curvature: [0.5, -0.5] },
                textPosition: -0.25,
            });
        }
    }
    // create embedded label font css
    const labelFont = await embedFonts(labels.map(({ text }) => text).join(''), Asset.fonts.consolas),
        labelGrid = [labelFontSize * (labelFont.fontColumnWidth ?? 0.6), labelFontSize * labelLineHeight] as const;
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            viewBox={`0 0 ${context.size.width + ix * 2} ${context.size.height + iy * 2}`}
            width={scaleFactor * (context.size.width + ix * 2)}
            height={scaleFactor * (context.size.height + iy * 2)}
        >
            <g transform={`translate(${ix},${iy})`}>
                <Context.Provider value={context}>
                    <Window css={css} title={title}/>
                </Context.Provider>
                <g fill='none' stroke='#a88132'>
                    <rect
                        x={offsetX + paddingX + window.side}
                        y={offsetY + paddingY + window.top}
                        width={cw}
                        height={ch}
                    />
                    <rect
                        x={offsetX + paddingX}
                        y={offsetY + paddingY}
                        width={cw + window.side * 2}
                        height={ch + window.side + window.top}
                    />
                    <rect x={0} y={0} width={context.size.width} height={context.size.height} stroke='#c4c4c4'/>
                </g>
                <g fontSize={labelFontSize} fontFamily={labelFont.fontFamily}>
                    {labelFont.css ? <style dangerouslySetInnerHTML={{ __html: labelFont.css }}/> : null}
                    {labels.map((labelProps, i) => (
                        <DiagramLabel key={`label-${i}`} grid={labelGrid} {...labelProps}/>
                    ))}
                </g>
            </g>
        </svg>
    );
}

export default new Asset({
    id: 'window-options.svg',
    type: 'docs',
    render: async () => renderToStaticMarkup(
        await WindowOptionsDiagram({
            fontSize: 16,
            labelFontSize: 12,
            labelLineHeight: 1.25,
            insets: [1, 1],
            offsetX: 30,
            offsetY: 20,
            paddingX: 6,
            paddingY: 6,
            boxShadow: true,
            decorations: true,
            windowIcon: 'shell',
            windowTitle: 'Title',
        }),
    ),
});