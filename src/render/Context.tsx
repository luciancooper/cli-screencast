import { createContext } from 'react';
import type { Theme } from '../theme';

export interface RenderContext {
    theme: Theme<string>
    fontSize: number
    grid: readonly [number, number]
    duration: number
}

const Context = createContext<RenderContext>({} as RenderContext);

export default Context;