import type { FunctionComponent, SVGProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import icons from '@src/render/icons.json';
import Asset, { embedFonts } from '../asset';

interface IconsPreviewProps extends SVGProps<SVGElement> {
    fontSize: number
    lineHeight: number
    iconColumnWidth: number
    cols: number
    colspan: number
    fontFamily: string
    css?: string | null
    fontColumnWidth?: number | undefined
    spacing: number
    indent?: number
    padding: readonly [px: number, py: number]
    insets: readonly [ix: number, iy: number]
}

const IconsPreview: FunctionComponent<IconsPreviewProps> = ({
    fontSize,
    lineHeight,
    iconColumnWidth,
    cols,
    colspan,
    fontFamily,
    css,
    fontColumnWidth,
    spacing,
    indent = spacing,
    padding: [px, py],
    insets: [ix, iy],
    ...props
}) => {
    const [gx, gy] = [fontSize * (fontColumnWidth ?? 0.6), fontSize * lineHeight],
        size = Math.min(gx * iconColumnWidth, gy),
        insy = (gy - size) / 2,
        rows = Math.ceil(Object.keys(icons).length / cols),
        width = 2 * px + cols * colspan + (cols - 1) * spacing,
        height = 2 * py + rows * gy + (rows - 1) * spacing;
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            fontFamily={fontFamily}
            fontSize={fontSize}
            width={2 * ix + width}
            height={2 * iy + height}
            {...props}
        >
            <style dangerouslySetInnerHTML={{ __html: `text{white-space:pre}${css ?? ''}` }}/>
            <defs>
                {Object.entries(icons).map(([id, { path: d }]) => (
                    <symbol key={id} id={id} viewBox='0 0 1 1'>
                        <path d={d}/>
                    </symbol>
                ))}
            </defs>
            <rect x={ix} y={iy} width={width} height={height} fill='#282a36' rx={5} ry={5}/>
            {Object.keys(icons).map((id, x) => {
                const tx = ix + px + (x % cols) * (colspan + spacing),
                    ty = iy + py + Math.floor(x / cols) * (gy + spacing);
                return (
                    <g key={id} transform={`translate(${tx}, ${ty})`}>
                        <use xlinkHref={`#${id}`} y={insy} width={size} height={size} fill='#ffffff'/>
                        <text x={size + indent} y={insy + size / 2} dominantBaseline='central' fill='#ffffff'>
                            {`'${id}'`}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

export default new Asset({
    id: 'window-icons.svg',
    type: 'docs',
    render: async () => {
        // create embedded font
        const font = await embedFonts(Object.keys(icons).map((k) => `'${k}'`).join(''), Asset.fonts.cascadiaCode);
        // render svg and save to file
        return renderToStaticMarkup(
            <IconsPreview
                fontSize={16}
                lineHeight={1.4}
                iconColumnWidth={1.6}
                cols={3}
                colspan={150}
                spacing={3}
                indent={10}
                padding={[20, 20]}
                insets={[30, 20]}
                {...font}
            />,
        );
    },
});