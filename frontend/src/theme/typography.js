const display = '"Fraunces", "Georgia", serif';
const body = '"Outfit", "Segoe UI", system-ui, sans-serif';

export const typography = {
  fontFamily: body,
  h1: {
    fontFamily: display,
    fontWeight: 600,
    fontSize: 'clamp(2.2rem, 4vw, 3.4rem)',
    lineHeight: 1.08,
    letterSpacing: '-0.03em',
  },
  h2: {
    fontFamily: display,
    fontWeight: 600,
    fontSize: 'clamp(1.9rem, 3vw, 2.6rem)',
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
  },
  h3: {
    fontFamily: display,
    fontWeight: 600,
    fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)',
    lineHeight: 1.16,
    letterSpacing: '-0.02em',
  },
  h4: {
    fontFamily: display,
    fontWeight: 600,
    fontSize: 'clamp(1.45rem, 2vw, 1.9rem)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h5: {
    fontFamily: display,
    fontWeight: 600,
    fontSize: 'clamp(1.2rem, 1.6vw, 1.45rem)',
    lineHeight: 1.25,
  },
  h6: {
    fontFamily: display,
    fontWeight: 600,
    fontSize: '1.05rem',
    lineHeight: 1.3,
  },
  subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.45 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.55 },
  button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  caption: { fontSize: '0.75rem', lineHeight: 1.4 },
  overline: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    lineHeight: 1.6,
  },
};
