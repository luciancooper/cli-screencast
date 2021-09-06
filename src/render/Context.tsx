import { createContext } from 'react';
import type { Theme } from '../theme';

const Context = createContext<Theme>({} as Theme);

export default Context;