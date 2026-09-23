import React from 'react';
import { Container } from '@mui/material';

const PageContainer = ({ children, maxWidth = 'lg', sx, ...props }) => (
  <Container maxWidth={maxWidth} sx={{ mt: 3, mb: 4, ...sx }} {...props}>
    {children}
  </Container>
);

export default PageContainer;
