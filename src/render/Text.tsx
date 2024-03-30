import { useContext, type FunctionComponent, type SVGProps } from 'react';
import type { OmitStrict, AnsiStyle, AnsiStyleProps } from '../types';
import Context from './Context';

interface TextProps extends OmitStrict<AnsiStyle, 'props'>, Partial<AnsiStyleProps>, SVGProps<SVGTextElement> {
    x: number
    y: number
    span: number
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
        bgColor = inverted ? fg ?? theme.text : bg,
        color = inverted ? bg ?? theme.background : fg ?? theme.text,
        props: SVGProps<SVGTextElement> = {
            ...textProps,
            x: x * dx,
            y: y * dy + dy / 2,
            fill: color,
            textDecoration: decoration || undefined,
            fontWeight: bold ? 'bold' : undefined,
            fontStyle: italic ? 'italic' : undefined,
            opacity: dim ? theme.dim : undefined,
        },
        element = <text {...props}>{children}</text>;
    return (
        <>
            {bgColor ? <rect fill={bgColor} x={x * dx} y={y * dy} width={span * dx} height={dy}/> : null}
            {link ? <a href={link}>{element}</a> : element}
        </>
    );
};

export default Text;