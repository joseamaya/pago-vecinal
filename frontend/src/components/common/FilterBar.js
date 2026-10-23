import React, { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';

const FilterBar = ({ children, chips = [], onClear, sx, disableCollapse = false }) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(!isCompact && !disableCollapse ? true : false);
  const showToggle = !disableCollapse && isCompact;

  return (
    <Paper
      sx={[
        { mb: 2.5, overflow: 'hidden' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.25,
          minHeight: 56,
        }}
      >
        <Badge badgeContent={chips.length} color="primary" overlap="circular">
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              borderRadius: 2,
              bgcolor: 'action.hover',
              color: 'primary.main',
            }}
          >
            <FilterListIcon sx={{ fontSize: 19 }} />
          </Box>
        </Badge>
        <Typography variant="subtitle2" sx={{ ml: 0.5, flexGrow: 1 }}>
          Filtros
        </Typography>
        {chips.length > 0 && onClear && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={onClear} sx={{ color: 'text.secondary' }}>
            Limpiar
          </Button>
        )}
        {showToggle && (
          <IconButton
            size="small"
            onClick={() => setExpanded((current) => !current)}
            aria-label={expanded ? 'Ocultar filtros' : 'Mostrar filtros'}
            aria-expanded={expanded}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>

      <Collapse in={!showToggle || expanded} timeout="auto">
        <Box
          sx={{
            px: 2,
            pb: chips.length > 0 ? 1.5 : 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
            '& > *': { flex: { xs: '1 1 100%', sm: '0 1 200px' }, minWidth: { sm: 170 } },
          }}
        >
          {children}
        </Box>
        {chips.length > 0 && (
          <Box sx={{ px: 2, pb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {chips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                size="small"
                onDelete={chip.onRemove}
                sx={(theme) => ({
                  bgcolor: theme.palette.action.selected,
                  color: 'text.primary',
                  '& .MuiChip-deleteIcon': { color: 'text.secondary' },
                })}
              />
            ))}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default FilterBar;
