import type { IconID, Title } from './types';
import icons from './render/icons.json';

const iconMap = (
    Object.entries(icons) as [IconID, { alias?: string[], path: string }][]
).reduce<Record<string, IconID>>((acc, [key, { alias = [] }]) => {
    for (const k of [key, ...alias]) acc[k] = key;
    return acc;
}, {});

export function matchIcon(string: string, fallback: IconID = 'shell'): IconID {
    const cmd = string.split(' ')[0]!;
    return cmd.length ? (iconMap[cmd] ?? fallback) : fallback;
}

export function resolveTitle(text?: string, icon?: string | boolean): Title {
    return {
        text,
        icon: icon ? matchIcon(typeof icon === 'boolean' ? text ?? '' : icon) : undefined,
    };
}