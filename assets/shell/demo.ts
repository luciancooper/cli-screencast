import { resolve } from 'path';
import { captureSpawn } from '@src';

captureSpawn('node', ['capture.js'], {
    logLevel: 'debug',
    output: 'yaml',
    columns: 100,
    rows: 15,
    cwd: __dirname,
    endTimePadding: 1500,
    silent: false,
    connectStdin: true,
    outputPath: resolve(__dirname, '../docs/data/shell-demo.yaml'),
});