import path from 'path';
import { renderScreen, captureSpawn, captureCallback, captureFrames, renderData } from '@src';
import Asset from '../asset';

export default [
    // renderScreen.md examples
    new Asset({
        id: 'usage--screen.svg',
        type: 'docs',
        render: () => renderScreen(
            'Hello \x1b[33mWorld!\x1b[39m',
            { ...Asset.fonts.cascadiaCode, columns: 50, rows: 10 },
        ),
    }),
    // captureSpawn.md examples
    new Asset({
        id: 'usage--spawn.svg',
        type: 'docs',
        render: () => captureSpawn('echo', ['Hello World!'], {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            shell: process.platform === 'win32',
            cursorHidden: true,
            includeCommand: false,
        }),
    }),
    new Asset({
        id: 'usage--spawn--prompt.svg',
        type: 'docs',
        render: () => captureSpawn('echo', ['Hello World!'], {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            shell: process.platform === 'win32',
            cursorHidden: true,
            includeCommand: true,
        }),
    }),
    // captureCallback.md examples
    new Asset({
        id: 'usage--callback--stdout.svg',
        type: 'docs',
        render: () => captureCallback((capture) => {
            console.log('1st write...');
            capture.wait(1500); // artificially wait 1500 ms in the capture recording
            process.stdout.write('2nd write...');
            capture.wait(1500); // wait 1500 ms
            console.log('\n3rd write...');
            capture.wait(1500); // wait 1500 ms
        }, {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            theme: { cursorBlink: true },
        }),
    }),
    new Asset({
        id: 'usage--callback--stdin.svg',
        type: 'docs',
        render: () => captureCallback(async (capture) => {
            // create a readline interface
            const rl = capture.createInterface(),
                // ask the user a question
                promise = new Promise<string>((resolve) => {
                    rl.question('Write a message: ', resolve);
                });
            // wait 1s
            capture.wait(1000);
            // mock the user typing their response
            capture.emitKeypressSequence([
                'H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd', '!', 'return',
            ]);
            // wait for the response to resolve
            const result = await promise;
            // display the user's response
            console.log(`Your Message: ${result}`);
            // close the readline interface
            rl.close();
        }, { ...Asset.fonts.cascadiaCode, columns: 50, rows: 10 }),
    }),
    new Asset({
        id: 'usage--callback--command.svg',
        type: 'docs',
        render: () => captureCallback((capture) => {
            capture.start('echo Hello World!');
            console.log('Hello World!');
        }, {
            ...Asset.fonts.cascadiaCode,
            cursorHidden: true,
            columns: 50,
            rows: 10,
        }),
    }),
    // captureFrames.md examples
    new Asset({
        id: 'usage--frames.svg',
        type: 'docs',
        render: () => captureFrames(['⡇', '⠏', '⠋', '⠙', '⠹', '⢸', '⣰', '⣠', '⣄', '⣆'].map((frame) => ({
            content: `\r\x1b[33m${frame}\x1b[39m Loading`,
            duration: 90,
        })), {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            cursorHidden: true,
            endTimePadding: 0,
        }),
    }),
    new Asset({
        id: 'usage--frames--command.svg',
        type: 'docs',
        render: () => captureFrames([
            { content: '', duration: 500 },
            { content: '\x1b[32m✔\x1b[39m Task 1 Complete\n', duration: 1500 },
            { content: '\x1b[32m✔\x1b[39m Task 2 Complete\n', duration: 1500 },
            { content: '\x1b[31m✘\x1b[39m Task 3 Failed\n', duration: 1500 },
        ], {
            ...Asset.fonts.cascadiaCode,
            command: 'node tasks.js',
            columns: 50,
            rows: 10,
            cursorHidden: true,
        }),
    }),
    // renderData.md examples
    Asset.chain([
        new Asset({
            id: 'capture--data.yaml',
            type: 'docs',
            render: () => captureFrames([
                { content: 'Hello World!', duration: 1500 },
                { content: '\n1st Write...', duration: 1500 },
                { content: '\n2nd Write...', duration: 1500 },
                { content: '\n3rd Write...', duration: 1500 },
            ], {
                output: 'yaml',
                columns: 50,
                rows: 10,
                cursorHidden: true,
            }),
        }),
        new Asset({
            id: 'usage--data.svg',
            type: 'docs',
            render: (yaml: Asset) => renderData(
                yaml.absPath,
                { ...Asset.fonts.cascadiaCode },
            ),
        }),
    ]),
    // captureShell.md examples
    new Asset({
        id: 'usage--shell--capture.svg',
        type: 'docs',
        render: () => renderData(
            path.resolve(__dirname, './data/shell-capture.yaml'),
            { ...Asset.fonts.cascadiaCodeNF, theme: { cursorStyle: 'underline', cursorBlink: true } },
        ),
    }),
    new Asset({
        id: 'usage--shell--demo.svg',
        type: 'docs',
        render: () => renderData(path.resolve(__dirname, './data/shell-demo.yaml'), {
            ...Asset.fonts.cascadiaCodeNF,
            includeCommand: true,
            keystrokeAnimationInterval: 150,
            prompt: '\x1b[48;2;97;175;239;38;2;255;255;255m  \x1b[0;38;2;97;175;239m\x1b[0;38;2;198;120;221;7m'
                + '\x1b[0;48;2;198;120;221;38;2;255;255;255m ~  examples \x1b[0;38;2;198;120;221m\x1b[0m ',
            theme: { cursorBlink: true },
        }),
    }),
    // window.md examples
    new Asset({
        id: 'usage--window--title-screenshot.svg',
        type: 'docs',
        render: () => renderScreen('\x1b]0;node\x07Hello World!', {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            windowTitle: 'Overwritten Title',
        }),
    }),
    new Asset({
        id: 'usage--window--title-callback.svg',
        type: 'docs',
        render: () => captureCallback((capture) => {
            process.stdout.write('Hello World!');
            capture.wait(2000); // wait 2s
            // change the title to 'Next Title' and the icon to 'node'
            process.stdout.write('\x1b]2;Next Title\x07\x1b]1;node\x07');
            capture.wait(2000); // wait 2s
            // change the title to 'Last Title' and the icon to 'code'
            capture.setTitle({ title: 'Last Title', icon: 'code' });
            capture.wait(2000); // wait 2s
            // clear both the window title and icon
            capture.setTitle({ title: '', icon: '' });
            capture.wait(2000); // wait 2s
        }, {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            cursorHidden: true,
            windowTitle: 'Initial Title',
            windowIcon: 'shell',
        }),
    }),
    new Asset({
        id: 'usage--window--shadow.svg',
        type: 'docs',
        render: () => renderScreen('Hello World!', {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            windowTitle: 'Box Shadow',
            boxShadow: true,
        }),
    }),
    new Asset({
        id: 'usage--window--shadow-offset.svg',
        type: 'docs',
        render: () => renderScreen('Hello World!', {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            windowTitle: 'Box Shadow with Offset',
            boxShadow: { dx: 2, dy: 2 },
        }),
    }),
    // theme.md examles
    Asset.chain([
        new Asset({
            id: 'colortest.yaml',
            type: 'static',
            path: 'files',
            render: () => {
                const bg = [40, 41, 42, 43, 44, 45, 46, 47],
                    fg = [30, 90, 31, 91, 32, 92, 33, 93, 34, 94, 35, 95, 36, 96, 37, 97],
                    line = `  gYw   ${bg.map((c) => `\x1b[${c}m  gYw  \x1b[49m`).join(' ')}\x1b[39m`;
                return renderScreen(
                    `      ${['       ', ...bg.map((c) => `  ${c}m  `)].join(' ')}`
                    + `\n      ${line}`
                    + fg.map((c) => `\n ${c}m  \x1b[${c}m${line}`).join(''),
                    {
                        output: 'yaml',
                        columns: 80,
                        rows: 18,
                        windowTitle: 'colortest',
                        windowIcon: 'compile',
                    },
                );
            },
        }),
        [
            new Asset({
                id: 'theme--default.svg',
                type: 'docs',
                render: (colortest) => renderData(colortest.absPath, {
                    ...Asset.fonts.cascadiaCode,
                }),
            }),
            new Asset({
                id: 'theme--material.svg',
                type: 'docs',
                render: (colortest) => renderData(colortest.absPath, {
                    ...Asset.fonts.cascadiaCode,
                    theme: {
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
                        iconColor: '#1a1a19',
                    },
                }),
            }),
        ],
    ]),
    // output.md examples
    Asset.chain([
        new Asset({
            id: 'usage--output--capture.yaml',
            type: 'docs',
            render: () => captureFrames([
                { content: 'Hello', duration: 1500 },
                { content: ' World!', duration: 1500 },
            ], { output: 'yaml', columns: 50, rows: 10 }),
        }),
        [
            new Asset({
                id: 'usage--output--capture.json',
                type: 'docs',
                render: (data) => renderData(data.absPath, { output: 'json' }).then((json) => (
                    JSON.stringify(JSON.parse(json as string), null, 2)
                )),
            }),
            new Asset({
                id: 'usage--output--capture.svg',
                type: 'docs',
                render: (data) => renderData(data.absPath, { output: 'svg', ...Asset.fonts.cascadiaCode }),
            }),
            new Asset({
                id: 'usage--output--capture.png',
                type: 'docs',
                render: (data) => renderData(data.absPath, { output: 'png', ...Asset.fonts.cascadiaCode }),
            }),
        ],
    ]),
    // fonts.md examples
    new Asset({
        id: 'usage--fonts.svg',
        type: 'docs',
        render: () => renderScreen('\uf31b \x1b[36m~/..\ue5fe../project\x1b[39;32m \ue725 main\x1b[39m \uf105 ', {
            columns: 80,
            rows: 10,
            cursorHidden: false,
            theme: { cursorStyle: 'underline', cursorBlink: true },
            ...Asset.fonts.cascadiaCodeNF,
        }),
    }),
];