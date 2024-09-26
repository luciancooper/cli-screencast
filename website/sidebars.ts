import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    docsSidebar: [{
        type: 'doc',
        label: 'Introduction',
        id: 'introduction',
    }, {
        type: 'category',
        label: 'API',
        items: [
            'renderScreen',
            'captureSpawn',
            'captureShell',
            'captureCallback',
            'captureFrames',
            'renderData',
        ],
    }, {
        type: 'category',
        label: 'Configuration',
        items: [
            'options',
            'output',
            'window',
            'theme',
        ],
    }],
};

export default sidebars;