import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FunctionComponent, SVGProps } from 'react';
import type { Size } from '@src/types';
import { applyDefRenderOptions, applyDefTerminalOptions } from '@src/options';
import { resolveTheme } from '@src/theme';
import { dataFromFile } from '@src/data';
import { parseScreen } from '@src/parser';
import Context, { useRenderContext } from '@src/render/Context';
import Window from '@src/render/Window';
import Frame from '@src/render/Frame';
import { Cursor } from '@src/render/Cursor';
import { resolveContext } from '@src/render';
import Asset, { embedFonts } from '../asset';
import GearIcon from './icons/Gears';
import FileTypeIcon from './icons/FileType';

const SVGImage: FunctionComponent<Size & SVGProps<SVGSVGElement>> = ({ children, ...props }) => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        xmlnsXlink='http://www.w3.org/1999/xlink'
        viewBox={`0 0 ${props.width} ${props.height}`}
        {...props}
    >
        {children}
    </svg>
);

const CaptureBorder: FunctionComponent<{ strokeWidth: number, dash: number }> = ({ strokeWidth, dash }) => {
    const { size: { width, height }, borderRadius } = useRenderContext();
    return (
        <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={width - strokeWidth}
            height={height - strokeWidth}
            rx={borderRadius}
            ry={borderRadius}
            stroke='#4cb7e6'
            fill='none'
            strokeLinecap='round'
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${dash + strokeWidth * 2}`}
        >
            <animate
                attributeName='stroke-dashoffset'
                dur='0.5s'
                values={`0;${dash * 2 + strokeWidth * 2}`}
                repeatCount='indefinite'
            />
        </rect>
    );
};

export default [
    // capture feature icon
    new Asset({
        id: 'feature-capture.svg',
        type: 'static',
        path: 'assets',
        render: async () => {
            const content = '> ',
                { css, ...font } = await embedFonts(content, Asset.fonts.cascadiaCode),
                parsed = parseScreen({ ...applyDefTerminalOptions({ columns: 32, rows: 8 }), content }),
                props = applyDefRenderOptions({ theme: { cursorBlink: true, cursorStyle: 'underline' }, fontSize: 16 }),
                context = resolveContext({ ...props, ...font }, parsed);
            return renderToStaticMarkup(
                <SVGImage {...context.size}>
                    <Context.Provider value={context}>
                        <Window css={css} title={parsed.title}>
                            <Frame lines={parsed.lines}/>
                            {parsed.cursor ? <Cursor animateBlink {...parsed.cursor}/> : null}
                        </Window>
                        <CaptureBorder strokeWidth={5} dash={16}/>
                    </Context.Provider>
                </SVGImage>,
            );
        },
    }),
    // export feature icon
    new Asset({
        id: 'feature-export.svg',
        type: 'static',
        path: 'assets',
        render: () => {
            // size of the image
            const [width, height] = [900, 625],
                // size of the gear & file icons
                [gear, file] = [250, 350],
                // x coords of left & right arrow start points
                [lx1, rx1] = [(width - gear) / 2 - 25, width - (width - gear) / 2 + 25],
                // x coords of left & right arrow end points
                [lx2, rx2] = [file * 0.53735, width - file * 0.53735],
                // y coords of arrow start and end points
                [y1, y2] = [gear / 2, (height - file) - 35],
                // offset % for control point 1
                [c1px, c1py] = [0.70, 0.1],
                // offset % for control point 2
                [c2px, c2py] = [0.95, 0.35],
                // y coords for control points 1 & 2
                [c1y, c2y] = [y1 + c1py * (y2 - y1), y1 + c2py * (y2 - y1)],
                // x coords for left & right control point 1
                [lc1x, rc1x] = [lx1 + c1px * (lx2 - lx1), rx1 + c1px * (rx2 - rx1)],
                // x coords for left & right control point 2
                [lc2x, rc2x] = [lx1 + c2px * (lx2 - lx1), rx1 + c2px * (rx2 - rx1)];
            return renderToStaticMarkup(
                <SVGImage width={width} height={height}>
                    <defs>
                        <marker
                            id='arrowhead'
                            viewBox='0 0 10 10'
                            refX={5}
                            refY={5}
                            markerWidth={5}
                            markerHeight={5}
                            orient='auto-start-reverse'
                        >
                            <path d='M0,0L10,5L0,10L4,5z' fill='context-stroke'/>
                        </marker>
                        <GearIcon id='gear-icon' animate/>
                        <FileTypeIcon id='svg-file' type='svg' color='green'/>
                        <FileTypeIcon id='png-file' type='png' color='red'/>
                    </defs>
                    <use xlinkHref='#svg-file' x={0} y={height - file} width={file} height={file}/>
                    <use xlinkHref='#png-file' x={width - file} y={height - file} width={file} height={file}/>
                    <use xlinkHref='#gear-icon' fill='#b3b3b3' x={(width - gear) / 2} y={0} width={gear} height={gear}/>
                    <g fill='none' stroke='#1E88B8' strokeWidth={8} markerEnd='url(#arrowhead)'>
                        <path d={`M${lx1},${y1}C${lc1x},${c1y} ${lc2x},${c2y} ${lx2},${y2}`}/>
                        <path d={`M${rx1},${y1}C${rc1x},${c1y} ${rc2x},${c2y} ${rx2},${y2}`}/>
                    </g>
                </SVGImage>,
            );
        },
    }),
    // customize feature icon
    new Asset({
        id: 'feature-customize.svg',
        type: 'static',
        path: 'assets',
        render: async () => {
            const { type, data } = await dataFromFile(path.resolve(__dirname, './data/neofetch.yaml'));
            if (type !== 'screen') throw new Error('neofetch data is not screenshot');
            const parsed = parseScreen(data),
                { css, ...font } = await embedFonts(parsed, Asset.fonts.cascadiaCode),
                props = applyDefRenderOptions({ boxShadow: true, fontSize: 14 }),
                context = resolveContext({ ...props, ...font }, parsed),
                // alternate light theme
                lightTheme = resolveTheme({
                    black: '#212121',
                    red: '#b7141f',
                    green: '#457b24',
                    yellow: '#f6981e',
                    blue: '#134eb2',
                    magenta: '#560088',
                    cyan: '#0e717c',
                    white: '#efefef',
                    brightBlack: '#424242',
                    brightRed: '#e83b3f',
                    brightGreen: '#7aba3a',
                    brightYellow: '#ffea2e',
                    brightBlue: '#54a4f3',
                    brightMagenta: '#aa4dbc',
                    brightCyan: '#26bbd1',
                    brightWhite: '#d9d9d9',
                    background: '#eaeaea',
                    foreground: '#232322',
                }),
                // offset percentages
                [offsetX, offsetY] = [0.2, 0.3];
            return renderToStaticMarkup(
                <SVGImage width={context.size.width * (1 + offsetX)} height={context.size.height * (1 + offsetY)}>
                    <style dangerouslySetInnerHTML={{ __html: css ?? '' }}/>
                    <Context.Provider value={context}>
                        <Window title={parsed.title}>
                            <Frame lines={parsed.lines}/>
                        </Window>
                    </Context.Provider>
                    <Context.Provider value={{ ...context, theme: lightTheme }}>
                        <Window title={parsed.title} x={context.size.width * offsetX} y={context.size.height * offsetY}>
                            <Frame lines={parsed.lines}/>
                        </Window>
                    </Context.Provider>
                </SVGImage>,
            );
        },
    }),
];