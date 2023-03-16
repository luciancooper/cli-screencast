import path from 'path';
import { promises as fs } from 'fs';

const testFontsPath = path.resolve(__dirname, '../__tests__/fonts');

export default function systemFontPaths(): Promise<string[]> {
    return fs.readdir(testFontsPath).then((files) => (
        files.filter((f) => /(?:ttf|otf|ttc)$/.test(f)).sort().map((f) => path.join(testFontsPath, f))
    ));
}