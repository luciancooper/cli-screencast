import { captureFrames, type SourceFrame } from '@src';
import Asset from '../asset';

const frames: SourceFrame[] = [
    { content: '\x1b[33mcli-screencast\x1b[39m', duration: 5000 },
    { content: '\r\x1b[0K', duration: 1800 },
    { content: '\x1b[33mc\x1b[39m', duration: 200 },
    { content: '\x1b[33ml\x1b[39m', duration: 200 },
    { content: '\x1b[33mi\x1b[39m', duration: 200 },
    { content: '\x1b[33m-\x1b[39m', duration: 200 },
    { content: '\x1b[33ms\x1b[39m', duration: 200 },
    { content: '\x1b[33mc\x1b[39m', duration: 200 },
    { content: '\x1b[33mr\x1b[39m', duration: 200 },
    { content: '\x1b[33me\x1b[39m', duration: 200 },
    { content: '\x1b[33me\x1b[39m', duration: 200 },
    { content: '\x1b[33mn\x1b[39m', duration: 200 },
    { content: '\x1b[33mc\x1b[39m', duration: 200 },
    { content: '\x1b[33ma\x1b[39m', duration: 200 },
    { content: '\x1b[33ms\x1b[39m', duration: 200 },
];

export default new Asset({
    id: 'project-title.svg',
    type: 'static',
    path: 'assets',
    render: () => captureFrames(frames, {
        ...Asset.fonts.cascadiaCode,
        columns: 15,
        rows: 1,
        cursorHidden: false,
        endTimePadding: 0,
        fontSize: 48,
        lineHeight: 1.4,
        decorations: false,
        offsetX: 4,
        offsetY: 4,
        paddingX: 36,
        paddingY: 12,
        borderRadius: 22,
        theme: {
            yellow: '#f3f99d',
            background: '#282a36',
            cursorColor: '#d7d5c9',
            cursorStyle: 'underline',
            cursorBlink: true,
        },
    }),
});