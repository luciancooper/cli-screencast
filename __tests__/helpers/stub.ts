import { restoreProperty } from '@src/utils';

type RestoreCallback = () => void;

export default function stub<T, K extends keyof T>(obj: T, props: Record<K, T[K]>): RestoreCallback {
    // store original descriptors for stubbed props
    const descriptors = Object.keys(props).map((key) => [key as K, Object.getOwnPropertyDescriptor(obj, key)] as const);
    // set stubbed property values
    for (const [key, value] of Object.entries(props) as [K, T[K]][]) obj[key] = value;
    // return restore callback to restore object to its original state
    return () => {
        for (const [key, descriptor] of descriptors) restoreProperty(obj, key, descriptor);
    };
}