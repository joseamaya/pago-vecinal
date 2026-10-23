import React from 'react';
import { Box, Card, CardActionArea, Skeleton, Typography, alpha } from '@mui/material';
import { TrendingDown as TrendingDownIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material';

const getTone = (theme, tone = 'primary') => {
  const key = typeof tone === 'string' ? tone.split('.')[0] : 'primary';
  return theme.palette[key] || theme.palette.primary;
};

const StatCard = ({
  title,
  value,
  icon,
  color = 'primary',
  helper,
  trend,
  onClick,
  loading,
}) => {
  const content = (
    <>
      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: `linear-gradient(90deg, ${getTone(theme, color).main}, ${alpha(getTone(theme, color).main, 0.15)})`,
        })}
      />
      <Box sx={{ p: { xs: 2.25, sm: 2.75 }, pt: { xs: 2.5, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {icon && (
            <Box
              sx={(theme) => ({
                display: 'grid',
                placeItems: 'center',
                width: 42,
                height: 42,
                borderRadius: 2.5,
                flexShrink: 0,
                color: getTone(theme, color).main,
                bgcolor: alpha(getTone(theme, color).main, theme.palette.mode === 'light' ? 0.12 : 0.18),
                '& svg': { fontSize: 22 },
              })}
            >
              {icon}
            </Box>
          )}
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', lineHeight: 1.3, fontSize: '0.67rem' }}
          >
            {title}
          </Typography>
        </Box>

        {loading ? (
          <Skeleton variant="text" width="65%" height={48} />
        ) : (
          <Typography
            variant="h4"
            component="p"
            className="tabular-nums"
            sx={{ color: 'text.primary', lineHeight: 1.1, mb: helper || trend ? 1 : 0 }}
          >
            {value}
          </Typography>
        )}

        {(helper || trend) && !loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {typeof trend === 'number' && (
              <Box
                sx={(theme) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1.5,
                  color: trend >= 0 ? theme.palette.success.main : theme.palette.error.main,
                  bgcolor: alpha(
                    trend >= 0 ? theme.palette.success.main : theme.palette.error.main,
                    theme.palette.mode === 'light' ? 0.12 : 0.2
                  ),
                })}
              >
                {trend >= 0 ? <TrendingUpIcon sx={{ fontSize: 15 }} /> : <TrendingDownIcon sx={{ fontSize: 15 }} />}
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {Math.abs(trend).toFixed(0)}%
                </Typography>
              </Box>
            )}
            {helper && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {helper}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </>
  );

  const cardSx = {
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
    ...(onClick && {
      '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.light' },
    }),
  };

  if (onClick) {
    return (
      <Card sx={cardSx}>
        <CardActionArea onClick={onClick} sx={{ height: '100%', borderRadius: 'inherit' }}>
          {content}
        </CardActionArea>
      </Card>
    );
  }

  return <Card sx={cardSx}>{content}</Card>;
};

export default StatCard;
