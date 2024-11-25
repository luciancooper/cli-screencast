import { createContext, useContext } from 'react';
import type { Dimensions, RGBA, Size } from '../types';
import type { Theme } from '../theme';
import type { BoxShadowOptions } from './BoxShadow';

export interface RenderContext extends Dimensions {
    theme: Theme<RGBA>
    fontSize: number
    fontFamily: string
    borderRadius: number
    boxShadow: Required<BoxShadowOptions> | null
    decorations: boolean
    padding: [paddingX: number, paddingY: number]
    offset: [offsetX: number, offseY: number]
    grid: [dx: number, dy: number]
    iconColumnWidth: number
    duration: number
    window: { top: number, side: number } & Size
    size: Size
}

const Context = createContext<RenderContext>({} as RenderContext);

export function useRenderContext(): RenderContext {
    return useContext(Context);
}

export default Context;