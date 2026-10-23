import React from 'react';
import { Container } from '@mui/material';

const PageContainer = ({ children, maxWidth = 'lg', sx, ...props }) => (
  <Container
    maxWidth={maxWidth}
    sx={[
      {
        px: { xs: 2, sm: 3 },
        py: { xs: 2.5, md: 4 },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
    {...props}
  >
    {children}
  </Container>
);

export default PageContainer;
