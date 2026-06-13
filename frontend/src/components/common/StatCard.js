import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import LoadingSpinner from './LoadingSpinner';

const StatCard = ({ title, value, icon, color, onClick, loading }) => (
  <Card sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        {icon}
        <Typography variant="h6" component="div" sx={{ ml: 1 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36 }}>
        {loading ? (
          <LoadingSpinner size={24} showMessage={false} />
        ) : (
          <Typography variant="h4" component="div" color={color}>
            {value}
          </Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

export default StatCard;
