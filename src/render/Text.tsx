import { useContext } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import type { AnsiStyle } from '../types';
import { toHex } from '../color';
import Context from './Context';

interface TextProps extends Partial<AnsiStyle>, SVGProps<SVGTextElement> {
    x: number
    span: number
}

const Text: FunctionComponent<TextProps> = ({
    x,
    span,
    foreground,
    background,
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
        bgColor = inverted ? foreground ?? toHex(theme.text) : background,
        color = inverted ? background ?? toHex(theme.background) : foreground ?? toHex(theme.text),
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