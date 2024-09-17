import { join, resolve, relative } from 'path';
import { existsSync as pathExists } from 'fs';
import { rm } from 'fs/promises';
import { resolveFonts, embedFontCss } from '@src/fonts';
import { writeToFile } from '@src/utils';
import log from '@src/logger';

interface FontFamily {
    fontFamily: string
    fonts: string[]
}

export async function embedFonts(data: Parameters<typeof resolveFonts>[0], family: FontFamily, png = false) {
    const { fontColumnWidth, ...resolvedFonts } = await resolveFonts(data, family.fontFamily, family.fonts),
        { fontFamily, [png ? 'png' : 'svg']: css } = await embedFontCss(resolvedFonts, { svg: !png, png });
    return { fontColumnWidth, fontFamily, css };
}

type AssetType = 'docs' | 'static';

type RenderFunction = (...dependencies: Asset[]) => string | Buffer | Promise<string | Buffer>;

// resolve assets directory
const paths = {
    docs: resolve(__dirname, '../website/docs/assets'),
    static: resolve(__dirname, '../website/static'),
} satisfies Record<AssetType, string>;

export interface Creatable {
    create: () => Promise<void>
    remove: () => Promise<void>
}

export default class Asset implements Creatable {
    static fonts = {
        cascadiaCode: {
            fontFamily: 'Cascadia Code',
            fonts: [
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCode-Regular.ttf',
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCode-Bold.ttf',
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCode-Italic.ttf',
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCode-BoldItalic.ttf',
            ],
        },
        cascadiaCodeNF: {
            fontFamily: 'Cascadia Code NF',
            fonts: [
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCodeNF-Regular.ttf',
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCodeNF-Bold.ttf',
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCodeNF-Italic.ttf',
                'https://fontlib.s3.amazonaws.com/CascadiaCode/static/CascadiaCodeNF-BoldItalic.ttf',
            ],
        },
        consolas: {
            fontFamily: 'Consolas',
            fonts: [
                'https://fontlib.s3.amazonaws.com/Consolas/Consola.ttf',
                'https://fontlib.s3.amazonaws.com/Consolas/Consolab.ttf',
                'https://fontlib.s3.amazonaws.com/Consolas/Consolai.ttf',
                'https://fontlib.s3.amazonaws.com/Consolas/Consolaz.ttf',
            ],
        },
    } satisfies Record<string, FontFamily>;

    id: string;

    type: AssetType;

    dir: string;

    render: RenderFunction;

    constructor({
        id,
        type,
        path,
        render,
    }: { id: string, type: AssetType, path?: string, render: RenderFunction }) {
        this.id = id;
        this.type = type;
        this.dir = join(paths[type], path ?? '');
        this.render = render;
    }

    static chain(dependencyLevels: (Asset | Asset[])[]): Creatable {
        const assets: Asset[] = [];
        let dependencies: Asset[] | null = null;
        for (const level of dependencyLevels) {
            const array = Array.isArray(level) ? level : [level];
            if (dependencies) {
                // bind dependent assets to render functions
                for (const asset of array) asset.render = asset.render.bind(asset, ...dependencies);
            }
            assets.push(...array);
            dependencies = array;
        }
        return {
            async create() {
                for (const asset of assets) await asset.create();
            },
            async remove() {
                for (const asset of assets) await asset.remove();
            },
        };
    }

    get absPath(): string {
        return join(this.dir, this.id);
    }

    exists() {
        return pathExists(this.absPath);
    }

    async create() {
        // skip render if asset file already exists
        if (this.exists()) {
            log.info('%k skipping asset render', this.id);
            return;
        }
        log.info('%k rendering asset', this.id);
        const asset = await this.render();
        await writeToFile(this.absPath, asset);
        log.info('%k wrote asset to %S', this.id, relative(process.cwd(), this.dir));
    }

    async remove() {
        // stop if asset file does not exist
        if (!this.exists()) return;
        // delete asset file
        await rm(this.absPath);
        log.info('removed asset %S', relative(process.cwd(), this.absPath));
    }
}