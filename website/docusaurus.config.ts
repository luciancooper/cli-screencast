import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import npm2yarn from '@docusaurus/remark-plugin-npm2yarn';
import * as typedHeadings from './src/remark/typedHeadings';
import { codeBlockMeta, codeFileBlocks } from './src/remark/codeBlocks';
import gfmAlerts from './src/remark/gfmAlerts';
import colorLinks from './src/remark/colorLinks';
import transformDeflists from './src/remark/transformDeflists';
import transformKbd from './src/remark/transformKbd';
import tableColumns from './src/rehype/tableColumns';
import pngSize from './src/remark/pngSize';

const staticDirectories = ['static'];

const config: Config = {
    title: 'cli-screencast',
    titleDelimiter: '·',
    tagline: 'Capture terminal screenshots and recordings',
    url: 'https://cli-screencast.io',
    baseUrl: '/',
    staticDirectories,
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'assets/favicon.ico',
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },
    plugins: ['docusaurus-plugin-sass'],
    presets: [
        ['classic', {
            docs: {
                routeBasePath: '/',
                sidebarPath: './sidebars.ts',
                sidebarCollapsed: false,
                beforeDefaultRemarkPlugins: [
                    [codeFileBlocks, { siteDir: __dirname, staticDirectories }],
                    typedHeadings.pre,
                    colorLinks,
                ],
                remarkPlugins: [
                    [npm2yarn, { sync: true }],
                    [codeBlockMeta, { siteDir: __dirname, staticDirectories }],
                    typedHeadings.post,
                    gfmAlerts,
                    transformDeflists,
                    transformKbd,
                    pngSize,
                ],
                rehypePlugins: [
                    tableColumns,
                ],
            },
            blog: false,
            theme: {
                customCss: './src/scss/custom.scss',
            },
        } satisfies Preset.Options],
    ],
    themeConfig: {
        image: 'assets/social-card.png',
        tableOfContents: {
            minHeadingLevel: 2,
            maxHeadingLevel: 5,
        },
        navbar: {
            title: 'cli-screencast',
            logo: {
                alt: 'cli-screencast logo',
                src: 'assets/project-logo.svg',
                srcDark: 'assets/project-logo-dark.svg',
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'docsSidebar',
                    position: 'left',
                    label: 'Docs',
                },
                {
                    href: 'https://github.com/luciancooper/cli-screencast',
                    position: 'right',
                    className: 'header-github-link',
                    'aria-label': 'GitHub repository',
                },
            ],
        },
        footer: {
            style: 'dark',
            copyright: `Copyright © ${new Date().getFullYear()} Lucian Cooper. MIT licensed.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['json'],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;