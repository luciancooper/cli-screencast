import path from 'path';
import { existsSync as pathExists } from 'fs';
import log, { setLogLevel } from '@src/logger';
import renderWindowIcons from './media/window-icons';
import renderWindowOptions from './media/window-options';

const args = process.argv.slice(2),
    rebuild = args.includes('--rebuild') || args.includes('-r');

function shouldRender(filePath: string) {
    return rebuild || !pathExists(filePath);
}

(async () => {
    // set log level
    setLogLevel('debug');
    // resolve assets directory
    const dir = path.resolve(__dirname, '../website/docs/build');
    // render window icons diagram
    {
        const outputPath = path.join(dir, 'window-icons.svg');
        if (shouldRender(outputPath)) await renderWindowIcons(outputPath);
        else log.info('skipping window-icons render');
    }
    // render window options diagram
    {
        const outputPath = path.join(dir, 'window-options.svg');
        if (shouldRender(outputPath)) await renderWindowOptions(outputPath);
        else log.info('skipping window-options render');
    }
})();