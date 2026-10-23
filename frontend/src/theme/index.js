import { createTheme } from '@mui/material/styles';
import { lightPalette, darkPalette } from './palette';
import { typography } from './typography';
import { components } from './components';

export const buildTheme = (mode = 'light') =>
  createTheme({
    palette: mode === 'dark' ? darkPalette : lightPalette,
    typography,
    shape: { borderRadius: 12 },
    components,
  });

export { lightPalette, darkPalette };
