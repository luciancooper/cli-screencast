import { forwardRef, type SVGProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Size } from '@src/types';
import { createContentSubsets } from '@src/fonts/content';
import { createPng } from '@src/image';
import Asset, { embedFonts } from '../asset';
import { ProjectLogo } from './projectLogo';

interface SocialCardProps extends SVGProps<SVGElement> {
    width: number
    height: number
    header: string
    textLines: string[]
    headerFontSize: number
    headerLineHeight: number
    textFontSize: number
    textLineHeight: number
    fontFamily: string
    css: string | null
    fontColumnWidth: number | undefined
}

const SocialCard = forwardRef<Size, SocialCardProps>(({
    width,
    height,
    header,
    headerFontSize,
    headerLineHeight,
    textFontSize,
    textLineHeight,
    textLines,
    fontFamily,
    css,
    fontColumnWidth,
    children,
    ...props
}, ref) => {
    const size = { width, height },
        text_w = Math.max(...textLines.map((l) => l.length)) * textFontSize * (fontColumnWidth ?? 0.6),
        text_h = textLineHeight * textFontSize * textLines.length,
        header_w = header.length * headerFontSize * (fontColumnWidth ?? 0.6),
        header_h = headerFontSize * headerLineHeight,
        iconSize = text_h * 1.5,
        spacing_x = 2 * textFontSize * (fontColumnWidth ?? 0.6),
        spacing_y = (iconSize - text_h) / 2,
        header_x = (width - header_w) / 2,
        header_y = (height - header_h - spacing_y - Math.max(iconSize, text_h)) / 2,
        logo_x = (width - iconSize - spacing_x - text_w) / 2,
        logo_y = header_y + header_h + spacing_y,
        text_x = logo_x + iconSize + spacing_x,
        text_y = logo_y + (iconSize - text_h) / 2;
    if (typeof ref === 'function') ref(size);
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            xmlnsXlink='http://www.w3.org/1999/xlink'
            viewBox={`0 0 ${width} ${height}`}
            fontFamily={fontFamily}
            {...props}
        >
            <style
                dangerouslySetInnerHTML={{ __html: `text{white-space:pre;}${css ?? ''}` }}
            />
            <rect x={0} y={0} width={width} height={height} fill='#282a36'/>
            <text
                x={header_x}
                y={header_y + header_h / 2}
                fill='#f3f99d'
                fontWeight='bold'
                fontSize={headerFontSize}
                dominantBaseline='central'
            >
                {header}
            </text>
            <ProjectLogo
                x={logo_x}
                y={logo_y}
                size={iconSize}
                width={iconSize}
                height={iconSize}
                colors={{ window: '#eff1f5', icon: '#282a36' }}
                decorations={{ colors: ['#b30900', '#cc8b00', '#0b5b17'] }}
            />
            <g
                transform={`translate(${text_x},${text_y})`}
                dominantBaseline='central'
                fontSize={textFontSize}
                fill='#b9c0cb'
            >
                {textLines.map((line, i) => (
                    <text key={`text-${i}`} x={0} y={(i + 0.5) * (textLineHeight * textFontSize)}>{line}</text>
                ))}
            </g>
        </svg>
    );
});

export default new Asset({
    id: 'social-card.png',
    type: 'static',
    path: 'assets',
    render: async () => {
        const text = ['Capture and render terminal', 'recordings and screenshots'],
            header = 'cli-screencast',
            font = await embedFonts(createContentSubsets([text.join(''), header]), Asset.fonts.cascadiaCode, true);
        let size = { width: NaN, height: NaN };
        const frame = renderToStaticMarkup(
            <SocialCard
                ref={(s) => { size = s!; }}
                width={1200}
                height={675}
                header={header}
                headerFontSize={128}
                headerLineHeight={1.2}
                textFontSize={48}
                textLineHeight={1.6}
                textLines={text}
                {...font}
            />,
        );
        return createPng({ frame, ...size }, 1);
    },
});