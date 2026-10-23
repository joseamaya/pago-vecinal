import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon, SubdirectoryArrowLeft as EnterIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFlatNavigation } from '../layout/navigation';

const CommandPalette = ({ open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo(() => getFlatNavigation(user?.role), [user?.role]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.text.toLowerCase().includes(term));
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const select = (item) => {
    if (!item) return;
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(filtered[active]);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden', mt: { xs: 2, sm: 8 }, position: 'absolute', top: { sm: 40 } } } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            autoFocus
            fullWidth
            placeholder="Buscar secciones, acciones…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
                    <EnterIcon sx={{ fontSize: 15 }} />
                    <Typography variant="caption">para ir</Typography>
                  </Box>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <List sx={{ p: 1, maxHeight: 380, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No encontramos secciones para “{query}”.
              </Typography>
            </Box>
          )}
          {filtered.map((item, index) => {
            const Icon = item.icon;
            return (
              <ListItemButton
                key={item.path}
                selected={index === active}
                onClick={() => select(item)}
                onMouseEnter={() => setActive(index)}
                sx={{ borderRadius: 2, mb: 0.25 }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
