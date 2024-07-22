import { createContext } from 'react';
import type { Dimensions, RGBA } from '../types';
import type { Theme } from '../theme';

export interface RenderContext extends Dimensions {
    theme: Theme<RGBA>
    fontSize: number
    grid: readonly [number, number]
    iconColumnWidth: number
    duration: number
}

const Context = createContext<RenderContext>({} as RenderContext);

export default Context;