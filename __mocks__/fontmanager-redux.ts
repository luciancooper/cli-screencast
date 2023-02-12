import path from 'path';
import fs from 'fs';
import type { FontDescriptor } from 'fontmanager-redux';

const testFontsPath = path.resolve(__dirname, '../__tests__/fonts');

export function getAvailableFonts(callback: (fonts: FontDescriptor[]) => void): void {
    fs.readdir(testFontsPath, (err, files) => {
        callback(files.filter((f) => /(?:ttf|otf|ttc)$/.test(f)).sort().map((f) => (
            { path: path.join(testFontsPath, f) } as unknown as FontDescriptor
        )));
    });
}