import path from 'path';
import { existsSync as pathExists } from 'fs';
import log, { setLogLevel } from '@src/logger';
import renderWindowIcons from './media/window-icons';
import renderWindowOptions from './media/window-options';
import renderProjectLogo from './media/project-logo';
import renderFavicon from './media/favicon';

const args = process.argv.slice(2),
    rebuild = args.includes('--rebuild') || args.includes('-r');

function shouldRender(filePath: string) {
    return rebuild || !pathExists(filePath);
}

// resolve assets directory
const dirs = {
    docs: path.resolve(__dirname, '../website/docs/build'),
    static: path.resolve(__dirname, '../website/static/build'),
};

(async () => {
    // set log level
    setLogLevel('debug');
    // render window icons diagram
    {
        const outputPath = path.join(dirs.docs, 'window-icons.svg');
        if (shouldRender(outputPath)) await renderWindowIcons(outputPath);
        else log.info('skipping window-icons render');
    }
    // render window options diagram
    {
        const outputPath = path.join(dirs.docs, 'window-options.svg');
        if (shouldRender(outputPath)) await renderWindowOptions(outputPath);
        else log.info('skipping window-options render');
    }
    // render project logo (light mode)
    {
        const outputPath = path.join(dirs.static, 'project-logo.svg');
        if (shouldRender(outputPath)) await renderProjectLogo(outputPath, false);
        else log.info('skipping project-logo render (light mode)');
    }
    // render project logo (dark mode)
    {
        const outputPath = path.join(dirs.static, 'project-logo-dark.svg');
        if (shouldRender(outputPath)) await renderProjectLogo(outputPath, true);
        else log.info('skipping project-logo render (dark mode)');
    }
    // render favicon
    {
        const outputPath = path.join(dirs.static, 'favicon.ico');
        if (shouldRender(outputPath)) await renderFavicon(outputPath);
        else log.info('skipping favicon render');
    }
})();