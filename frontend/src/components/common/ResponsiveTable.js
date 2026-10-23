import React from 'react';
import {
  Box,
  Card,
  Checkbox,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EmptyState from './EmptyState';

const cellValue = (column, row) =>
  column.render ? column.render(row) : row[column.key] ?? '—';

const SkeletonRows = ({ rows, columns }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <TableCell key={colIndex}>
            <Skeleton variant="text" height={24} width={colIndex === 0 ? '70%' : '55%'} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

const ResponsiveTable = ({
  columns = [],
  rows = [],
  loading = false,
  emptyState,
  getRowId = (row) => row.id,
  onRowClick,
  renderActions,
  actionsLabel = '',
  mobileTitle,
  mobileSubtitle,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  isSelectable = () => true,
  header,
  footer,
  dense = false,
  sx,
  paperSx,
  tableSx,
  skeletonRows = 5,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const visibleColumns = columns.filter((column) => !column.hidden);
  const mobileColumns = visibleColumns.filter((column) => column.mobile !== false);
  const allSelectable = rows.filter(isSelectable);
  const allSelected = selectable && allSelectable.length > 0 && allSelectable.every((row) => selectedIds.includes(getRowId(row)));
  const someSelected = selectable && selectedIds.length > 0 && !allSelected;

  const table = (
    <Table size={dense ? 'small' : 'medium'} sx={tableSx}>
      <TableHead>
        <TableRow>
          {selectable && (
            <TableCell padding="checkbox">
              {onToggleSelectAll && (
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onToggleSelectAll}
                  inputProps={{ 'aria-label': 'Seleccionar todos' }}
                />
              )}
            </TableCell>
          )}
          {visibleColumns.map((column) => (
            <TableCell key={column.key} align={column.align} sx={column.sx}>
              {column.label}
            </TableCell>
          ))}
          {renderActions && <TableCell align="right">{actionsLabel}</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {loading ? (
          <SkeletonRows rows={skeletonRows} columns={visibleColumns.length + (selectable ? 1 : 0) + (renderActions ? 1 : 0)} />
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0) + (renderActions ? 1 : 0)} sx={{ py: 0 }}>
              {emptyState || <EmptyState title="Sin resultados" description="Ajusta los filtros o agrega un registro." />}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => {
            const id = getRowId(row);
            const selectableRow = selectable && isSelectable(row);
            return (
              <TableRow
                key={id}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
                selected={selectableRow && selectedIds.includes(id)}
              >
                {selectable && (
                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    {selectableRow && (
                      <Checkbox
                        checked={selectedIds.includes(id)}
                        onChange={() => onToggleSelect?.(id)}
                        inputProps={{ 'aria-label': `Seleccionar ${id}` }}
                      />
                    )}
                  </TableCell>
                )}
                {visibleColumns.map((column) => (
                  <TableCell key={column.key} align={column.align} sx={column.sx}>
                    {cellValue(column, row)}
                  </TableCell>
                ))}
                {renderActions && (
                  <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                    {renderActions(row)}
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  if (isMobile) {
    return (
      <Box sx={sx}>
        {header && <Box sx={{ mb: 1.5 }}>{header}</Box>}
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Array.from({ length: skeletonRows }).map((_, index) => (
              <Card key={index} sx={{ p: 2 }}>
                <Skeleton variant="text" height={26} width="70%" />
                <Skeleton variant="text" height={20} width="50%" />
                <Skeleton variant="rounded" height={18} width="85%" sx={{ mt: 1 }} />
              </Card>
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <Card sx={{ py: 1 }}>
            {emptyState || <EmptyState title="Sin resultados" description="Ajusta los filtros o agrega un registro." />}
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {selectable && onToggleSelectAll && allSelectable.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onToggleSelectAll}
                  inputProps={{ 'aria-label': 'Seleccionar todos' }}
                  size="small"
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Seleccionar todos
                </Typography>
              </Box>
            )}
            {rows.map((row) => {
              const id = getRowId(row);
              const selectableRow = selectable && isSelectable(row);
              const title = mobileTitle ? mobileTitle(row) : cellValue(mobileColumns[0] || visibleColumns[0], row);
              const subtitle = mobileSubtitle ? mobileSubtitle(row) : null;
              const details = mobileColumns;

              return (
                <Card
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{
                    p: 2,
                    ...(onRowClick && { cursor: 'pointer', '&:active': { transform: 'scale(0.995)' } }),
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {selectableRow && (
                      <Checkbox
                        checked={selectedIds.includes(id)}
                        onChange={() => onToggleSelect?.(id)}
                        inputProps={{ 'aria-label': `Seleccionar ${id}` }}
                        sx={{ mt: -0.75, ml: -1 }}
                      />
                    )}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }} noWrap>
                        {title}
                      </Typography>
                      {subtitle && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                          {subtitle}
                        </Typography>
                      )}
                    </Box>
                    {renderActions && <Box sx={{ flexShrink: 0, mt: -0.75, mr: -0.75 }}>{renderActions(row)}</Box>}
                  </Box>

                  {details.length > 0 && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 1.25,
                        mt: 1.75,
                        pt: 1.5,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      {details.map((column) => (
                        <Box key={column.key} sx={{ minWidth: 0 }}>
                          <Typography
                            variant="overline"
                            component="div"
                            sx={{ color: 'text.disabled', fontSize: '0.62rem', lineHeight: 1.2 }}
                          >
                            {column.label}
                          </Typography>
                          <Box sx={{ mt: 0.25, fontSize: '0.875rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cellValue(column, row)}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
        )}
        {footer && <Box sx={{ mt: 1.5 }}>{footer}</Box>}
      </Box>
    );
  }

  return (
    <Paper sx={[{ overflow: 'hidden' }, ...(Array.isArray(paperSx) ? paperSx : [paperSx])]}>
      {header && (
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>{header}</Box>
      )}
      <TableContainer sx={{ maxWidth: '100%' }}>{table}</TableContainer>
      {footer && <Box sx={{ borderTop: 1, borderColor: 'divider' }}>{footer}</Box>}
    </Paper>
  );
};

export default ResponsiveTable;
