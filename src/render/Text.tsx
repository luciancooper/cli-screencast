import { useContext } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import type { OmitStrict, AnsiStyle, AnsiStyleProps } from '../types';
import { toHex } from '../color';
import Context from './Context';

interface TextProps extends OmitStrict<AnsiStyle, 'props'>, Partial<AnsiStyleProps>, SVGProps<SVGTextElement> {
    x: number
    span: number
}

const Text: FunctionComponent<TextProps> = ({
    x,
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
    const theme = useContext(Context),
        decoration = [...underline ? ['underline'] : [], strikeThrough ? ['line-through'] : []].join(' '),
        bgColor = inverted ? fg ?? toHex(theme.text) : bg,
        color = inverted ? bg ?? toHex(theme.background) : fg ?? toHex(theme.text),
        props: SVGProps<SVGTextElement> = {
            ...textProps,
            x: x * theme.fontSize * 0.6,
            y: theme.fontSize,
            fill: color,
            textDecoration: decoration || undefined,
            fontWeight: bold ? 'bold' : undefined,
            fontStyle: italic ? 'italic' : undefined,
            opacity: dim ? theme.dim : undefined,
            style: { whiteSpace: 'pre' },
        },
        element = <text {...props}>{children}</text>;
    return (
        <>
            {bgColor && (
                <rect fill={bgColor} x={x} y={0} width={span} height={theme.fontSize * theme.lineHeight}/>
            )}
            {link ? <a href={link}>{element}</a> : element}
        </>
    );
};

export default Text;