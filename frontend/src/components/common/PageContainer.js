import React from 'react';
import { Container } from '@mui/material';

const PageContainer = ({ children, ...props }) => (
  <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }} {...props}>
    {children}
  </Container>
);

export default PageContainer;
