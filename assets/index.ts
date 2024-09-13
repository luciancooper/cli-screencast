import { setLogLevel } from '@src/logger';
import type { Creatable } from './asset';
import favicon from './media/favicon';
import projectLogo from './media/projectLogo';
import windowIcons from './docs/windowIcons';
import windowOptions from './docs/windowOptions';
import usageExamples from './docs/usageExamples';

const assets: Creatable[] = [
    favicon,
    ...projectLogo,
    windowIcons,
    windowOptions,
    ...usageExamples,
];

const args = process.argv.slice(2);

(async () => {
    // set log level
    setLogLevel('debug');
    // check for cli flags
    const [clean, rebuild] = [args.includes('--clean'), args.includes('--rebuild')];
    // remove assets if clean or rebuild flag is present
    if (clean || rebuild) {
        for (const asset of assets) await asset.remove();
    }
    // create all assets if clean flag is not present
    if (!clean) {
        for (const asset of assets) await asset.create();
    }
})();