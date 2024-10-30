import { resolve } from 'path';
import { captureSpawn } from '@src';

captureSpawn('node', ['capture.js'], {
    logLevel: 'debug',
    output: 'yaml',
    columns: 100,
    rows: 15,
    cwd: __dirname,
    captureCommand: true,
    endTimePadding: 1500,
    keystrokeAnimationInterval: 150,
    prompt: '\x1b[48;5;75;38;5;15m  \x1b[0;38;5;75m\x1b[0;38;5;176;49;7m\x1b[0;48;5;176;38;5;15m ~  examples \x1b[0;38;5;176m\x1b[0m ',
    silent: false,
    connectStdin: true,
    outputPath: resolve(__dirname, '../docs/data/shell-demo.yaml'),
});