import { charWidths } from 'tty-strings';
import { useContext, type FunctionComponent, type SVGProps } from 'react';
import type { OmitStrict, AnsiStyle, AnsiStyleProps } from '../types';
import { themeColor, hexString, alphaValue } from '../color';
import Context from './Context';

interface TextProps extends OmitStrict<AnsiStyle, 'props'>, Partial<AnsiStyleProps>, SVGProps<SVGTextElement> {
    x: number
    y: number
    span: number
    children: string
}

const Text: FunctionComponent<TextProps> = ({
    x,
    y,
    span,
    fg,
    bg,
    link,
    bold = false,
    dim = false,
    italic = false,
    underline = false,
    inverted = false,
    strikeThrough = false,
    children,
    ...textProps
}) => {
    const { theme, grid: [dx, dy] } = useContext(Context),
        decoration = [...underline ? ['underline'] : [], strikeThrough ? ['line-through'] : []].join(' '),
        [fgc, bgc] = [themeColor(fg, theme), themeColor(bg, theme)],
        bgColor = inverted ? fgc ?? theme.text : bgc,
        color = inverted ? bgc ?? theme.background : fgc ?? theme.text,
        styleProps: SVGProps<SVGTextElement> = {
            ...textProps,
            fill: hexString(color),
            fillOpacity: alphaValue(color, true),
            textDecoration: decoration || undefined,
            fontWeight: bold ? 'bold' : undefined,
            fontStyle: italic ? 'italic' : undefined,
            opacity: dim ? theme.dim : undefined,
        },
        ty = y * dy + dy / 2;
    // split text at any full width grapheme clusters
    let [str, col, n] = ['', 0, 0];
    const chunks: [idx: number, str: string][] = [];
    for (const [char, width] of charWidths(children)) {
        str += char;
        n += width;
        if (width === 2) {
            chunks.push([col, str]);
            [col, str, n] = [col + n, '', 0];
        }
    }
    if (str) chunks.push([col, str]);
    // create text element - if there are full width graphemes, column align each chunk
    const element = chunks.length > 1 ? (
        <g {...styleProps}>
            {chunks.map(([i, chunk]) => <text key={i} x={(x + i) * dx} y={ty}>{chunk}</text>)}
        </g>
    ) : <text {...styleProps} x={x * dx} y={ty}>{children}</text>;
    // return react fragment
    return (
        <>
            {bgColor ? (
                <rect
                    x={x * dx}
                    y={y * dy - 0.15}
                    width={span * dx}
                    height={dy + 0.3}
                    fill={hexString(bgColor)}
                    fillOpacity={alphaValue(bgColor, true)}
                />
            ) : null}
            {link ? <a href={link}>{element}</a> : element}
        </>
    );
};

export default Text;