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

export async function embedFonts(data: Parameters<typeof resolveFonts>[0], family: FontFamily) {
    const { fontColumnWidth, ...resolvedFonts } = await resolveFonts(data, family.fontFamily, family.fonts),
        { fontFamily, svg: css } = await embedFontCss(resolvedFonts, { svg: true, png: false });
    return { fontColumnWidth, fontFamily, css };
}

type AssetType = 'docs' | 'static';

type RenderFunction = (this: Asset) => string | Buffer | Promise<string | Buffer>;

// resolve assets directory
const paths = {
    docs: resolve(__dirname, '../website/docs/assets'),
    static: resolve(__dirname, '../website/static'),
} satisfies Record<AssetType, string>;

export default class Asset {
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

    get absPath(): string {
        return join(this.dir, this.id);
    }

    exists() {
        return pathExists(this.absPath);
    }

    async create() {
        if (this.exists()) {
            log.info('skipping %k asset render', this.id);
            return;
        }
        log.info('rendering asset %k', this.id);
        const asset = await this.render();
        await writeToFile(this.absPath, asset);
        log.info('wrote asset %k to %S', this.id, relative(process.cwd(), this.dir));
    }

    async remove() {
        if (!this.exists()) return;
        await rm(this.absPath);
        log.info('removed asset %S', relative(process.cwd(), this.absPath));
    }
}