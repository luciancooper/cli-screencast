import { createContext } from 'react';
import type { Dimensions } from '../types';
import type { Theme } from '../theme';

export interface RenderContext extends Dimensions {
    theme: Theme<string>
    fontSize: number
    grid: readonly [number, number]
    iconSpan: number
    duration: number
}

const Context = createContext<RenderContext>({} as RenderContext);

export default Context;