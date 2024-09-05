import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import npm2yarnPlugin from '@docusaurus/remark-plugin-npm2yarn';
import * as typedHeadings from './src/remark/typed-headings';
import ghAlertsPlugin from './src/remark/gh-alerts';
import colorLinksPlugin from './src/remark/color-links';
import tablesPlugin from './src/rehype/tables';

const config: Config = {
    title: 'cli-screencast',
    titleDelimiter: '·',
    tagline: 'Capture terminal screenshots and recordings',
    url: 'https://cli-screencast.io',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'build/favicon.ico',
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
                    typedHeadings.prePlugin,
                    colorLinksPlugin,
                ],
                remarkPlugins: [
                    [npm2yarnPlugin, { sync: true }],
                    typedHeadings.postPlugin,
                    ghAlertsPlugin,
                ],
                rehypePlugins: [
                    tablesPlugin,
                ],
            },
            blog: false,
            theme: {
                customCss: './src/scss/custom.scss',
            },
        } satisfies Preset.Options],
    ],
    themeConfig: {
        tableOfContents: {
            minHeadingLevel: 3,
            maxHeadingLevel: 5,
        },
        navbar: {
            title: 'cli-screencast',
            logo: {
                alt: 'cli-screencast logo',
                src: 'build/project-logo.svg',
                srcDark: 'build/project-logo-dark.svg',
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
                    label: 'GitHub',
                    position: 'right',
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
        },
    } satisfies Preset.ThemeConfig,
};

export default config;