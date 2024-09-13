import { renderScreen, captureSpawn, captureCallback, captureFrames, renderData } from '@src';
import Asset from '../asset';

export default [
    new Asset({
        id: 'usage--screen.svg',
        type: 'docs',
        render: () => renderScreen(
            'Hello \x1b[33mWorld!\x1b[39m',
            { ...Asset.fonts.cascadiaCode, columns: 50, rows: 10 },
        ),
    }),
    new Asset({
        id: 'usage--spawn.svg',
        type: 'docs',
        render: () => captureSpawn('echo', ['Hello World!'], {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            shell: process.platform === 'win32',
            cursorHidden: true,
            captureCommand: false,
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
            captureCommand: true,
        }),
    }),
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
    new Asset({
        id: 'usage--frames.svg',
        type: 'docs',
        render: () => captureFrames([
            { content: 'Hello World!', duration: 1500 },
            { content: '\n1st Write...', duration: 1500 },
            { content: '\n2nd Write...', duration: 1500 },
            { content: '\n3rd Write...', duration: 1500 },
        ], {
            ...Asset.fonts.cascadiaCode,
            columns: 50,
            rows: 10,
            theme: { cursorBlink: true },
        }),
    }),
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
];