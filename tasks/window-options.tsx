import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FunctionComponent } from 'react';
import type { Dimensions } from '../src/types';
import { applyDefaults, type Options } from '../src/options';
import { resolveTitle } from '../src/title';
import createFontCss from '../src/fonts';
import Context from '../src/render/Context';
import Window from '../src/render/Window';
import { resolveContext } from '../src/render';
import log, { setLogLevel } from '../src/logger';

const labelFontProps = {
    fontSize: 12,
    lineHeight: 1.25,
    fontFamily: 'Consolas',
};

type DiagramLabelProps = {
    text: string
    coords: [number, number]
    size: [number, number]
    line: {
        angle: number // [0, 360]
        distance: number // distance between label and arrow point
        curvature: number | [number, number] // [-1, 1]
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

const DiagramLabel: FunctionComponent<DiagramLabelProps> = ({
    text,
    coords: [x, y],
    size: [w, h],
    position = 0.5,
    line: { angle, distance, curvature },
    textPosition = 0,
    color = '#eb3459',
    ...props
}) => {
    let shape: JSX.Element | null = null,
        [px, py] = [NaN, NaN];
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
        // text box
        tw = labelFontProps.fontSize * 0.6 * text.length,
        th = labelFontProps.fontSize * labelFontProps.lineHeight,
        // text position
        tx = ex - (cos < 0 ? tw : 0) + (textPosition < 0 ? textPosition * tw * Math.sign(cos) : 0),
        ty = ey - (sin > 0 ? th : 0) + (textPosition > 0 ? textPosition * th * Math.sign(sin) : 0);
    return (
        <g className='label'>
            <g stroke={color} fill='none'>
                {shape}
                <path d={d}/>
            </g>
            <rect x={tx} y={ty} width={tw} height={th} fill='#EFF1F2' rx={2}/>
            <text x={tx + tw / 2} y={ty + th / 2 + 1} fill='#000' textAnchor='middle' dominantBaseline='middle'>
                {text}
            </text>
        </g>
    );
};

interface DiagramOptions {
    scaleFactor: number
    insets: [number, number]
}

async function render({ scaleFactor, insets: [ix, iy], ...options }: Partial<Dimensions> & Options & DiagramOptions) {
    const props = applyDefaults({
            logLevel: 'debug',
            columns: 50,
            rows: 10,
            cursorHidden: true,
            theme: { fontFamily: "'Cascadia Code', 'CaskaydiaCove NF Mono'" },
            ...options,
        }),
        title = resolveTitle(props.palette, props.windowTitle, props.windowIcon),
        font = await createFontCss({ title, lines: [] }, props.theme.fontFamily),
        [context, windowOptions] = resolveContext({ ...props, ...font }),
        { columns, rows, grid: [dx, dy] } = context,
        { paddingX, paddingY } = windowOptions,
        top = windowOptions.decorations ? windowOptions.insetMajor : (title.icon || title.text) ? dy * 1.5 : 0,
        side = windowOptions.decorations ? windowOptions.insetMinor : 0,
        [cw, ch] = [columns * dx, rows * dy],
        width = cw + paddingX * 2 + side * 2,
        height = ch + paddingY * 2 + side + top,
        labels: DiagramLabelProps[] = [{
            // top side padding
            text: 'paddingY',
            kind: 'bar',
            direction: 'vertical',
            coords: [paddingX + side, 0],
            size: [cw, paddingY],
            position: 0.85,
            line: { angle: 315, distance: 20, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // bottom side padding
            text: 'paddingY',
            kind: 'bar',
            direction: 'vertical',
            coords: [paddingX + side, height - paddingY],
            size: [cw, paddingY],
            position: 0.85,
            line: { angle: 60, distance: 30, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // left side padding
            text: 'paddingX',
            kind: 'bar',
            direction: 'horizontal',
            coords: [0, paddingY + top],
            size: [paddingX, ch],
            line: { angle: 330, distance: 35, curvature: [0.7, 0.6] },
            textPosition: 0.5,
        }, {
            // right side padding
            text: 'paddingX',
            kind: 'bar',
            direction: 'horizontal',
            coords: [width - paddingX, paddingY + top],
            size: [paddingX, ch],
            line: { angle: 210, distance: 35, curvature: [0.7, 0.6] },
            textPosition: 0.5,
        }];
    // Decoration Insets
    if (windowOptions.decorations) {
        labels.push({
            text: 'insetMajor',
            kind: 'bar',
            direction: 'vertical',
            coords: [paddingX + side, paddingY],
            size: [cw, top],
            position: 0.8,
            barPosition: 0.75,
            line: { angle: 315, distance: 20, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            // left side inset
            text: 'insetMinor',
            kind: 'bar',
            direction: 'horizontal',
            coords: [paddingX, paddingY + top],
            size: [side, ch],
            position: 0.45,
            barPosition: 0.75,
            line: { angle: 45, distance: 25, curvature: [0.3, 0.8] },
            textPosition: 0.5,
        }, {
            // right side inset
            text: 'insetMinor',
            kind: 'bar',
            direction: 'horizontal',
            coords: [paddingX + cw + side, paddingY + top],
            size: [side, ch],
            position: 0.45,
            barPosition: 0.25,
            line: { angle: 135, distance: 25, curvature: [0.3, 0.8] },
            textPosition: 0.5,
        }, {
            // bottom side inset
            text: 'insetMinor',
            kind: 'bar',
            direction: 'vertical',
            coords: [paddingX + side, ch + paddingY + top],
            size: [cw, side],
            position: 0.8,
            barPosition: 0.25,
            line: { angle: 135, distance: 20, curvature: [-0.3, -0.8] },
            textPosition: -0.2,
        }, {
            text: 'decorations',
            kind: 'rect',
            side: 'bottom',
            coords: [paddingX + side * 0.4, paddingY + top * 0.2],
            size: [52, 12],
            line: { angle: 300, distance: 40, curvature: [0.8, 0.3] },
            textPosition: 0.5,
        });
    }
    // title labels
    if (title.icon || title.text) {
        const columnInset = windowOptions.decorations ? Math.ceil((50 - paddingX) / dx) : 0,
            [tx, ty] = [paddingX + side, paddingY + (top - dy) / 2];
        let iconX: number;
        if (title.columns) {
            const iconInset = title.icon ? Math.ceil(context.iconColumnWidth) + 1 : 0;
            let { columns: textSpan } = title;
            if (textSpan + iconInset > columns - columnInset) {
                textSpan = columns - iconInset - columnInset;
            }
            iconX = Math.max(Math.floor((columns - textSpan - iconInset) / 2), columnInset);
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
            iconX = Math.floor((columns - Math.ceil(context.iconColumnWidth)) / 2);
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
    const { css, fontFamily: labelFontFamily } = {
        fontFamily: labelFontProps.fontFamily,
        ...await createFontCss(
            labels.map(({ text }) => text).join(''),
            labelFontProps.fontFamily,
        ),
    };
    return renderToStaticMarkup(
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            viewBox={`0 0 ${width + ix * 2} ${height + iy * 2}`}
            width={scaleFactor * (width + ix * 2)}
            height={scaleFactor * (height + iy * 2)}
        >
            <g transform={`translate(${ix}, ${iy})`}>
                <Context.Provider value={context}>
                    <Window {...windowOptions} title={(title.icon || title.text) ? title : null}/>
                </Context.Provider>
                <g fill='none' stroke='#a88132'>
                    <rect x={paddingX + side} y={paddingY + top} width={cw} height={ch}/>
                    <rect x={paddingX} y={paddingY} width={cw + side * 2} height={ch + side + top}/>
                </g>
                <g fontSize={labelFontProps.fontSize} fontFamily={labelFontFamily}>
                    {css ? <style dangerouslySetInnerHTML={{ __html: css }}/> : null}
                    {labels.map((labelProps, i) => (
                        <DiagramLabel key={`label-${i}`} {...labelProps}/>
                    ))}
                </g>
            </g>
        </svg>,
    );
}

(async () => {
    // set log level
    setLogLevel('debug');
    // target directory
    const dir = path.resolve(__dirname, '../media');
    // make target directory if it does not exist
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    // render window options diagram
    try {
        log.info('rendering window options diagram');
        const filePath = path.resolve(dir, './window-options.svg');
        await fs.promises.writeFile(filePath, await render({
            scaleFactor: 1.25,
            insets: [30, 20],
            decorations: true,
            windowIcon: 'shell',
            windowTitle: 'Title',
        }));
        log.info('wrote window options diagram to %O', filePath);
    } catch (e: unknown) {
        console.log(e);
    }
})();