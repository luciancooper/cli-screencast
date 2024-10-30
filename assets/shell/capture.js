#!/usr/bin/env node
const { resolve } = require('path'),
    { homedir } = require('os'),
    { captureShell } = require('../../lib');

captureShell({
    shell: process.platform === 'win32' ? 'pwsh.exe' : 'zsh',
    cwd: homedir(),
    columns: 50,
    rows: 10,
    endTimePadding: 1000,
    output: 'yaml',
    outputPath: resolve(__dirname, '../docs/data/shell-capture.yaml'),
});