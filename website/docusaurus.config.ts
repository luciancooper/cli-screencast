import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'cli-screencast',
    titleDelimiter: '·',
    tagline: 'Capture terminal screenshots and recordings',
    url: 'https://cli-screencast.io',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },
    presets: [
        ['classic', {
            docs: {
                routeBasePath: '/',
                sidebarPath: './sidebars.ts',
                sidebarCollapsed: false,
            },
            blog: false,
            theme: {
                customCss: './src/css/custom.css',
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