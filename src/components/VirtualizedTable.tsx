import React, { forwardRef, memo, useMemo } from 'react';
import { TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Conditional import for react-window
let FixedSizeList: any = null;
try {
  const ReactWindow = require('react-window');
  FixedSizeList = ReactWindow.FixedSizeList;
} catch (error) {
  console.warn('react-window not available, VirtualizedTable will use fallback rendering');
}

interface ListChildComponentProps<T = any> {
  index: number;
  style: React.CSSProperties;
  data: T;
}

interface Column<T> {
  key: string;
  header: string;
  width: number;
  render: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  height: number;
  rowHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  getRowId?: (item: T, index: number) => string;
  overscanCount?: number;
  EmptyComponent?: React.ComponentType;
}

interface RowData<T> {
  items: T[];
  columns: Column<T>[];
  onRowClick?: (item: T, index: number) => void;
  getRowId?: (item: T, index: number) => string;
}

// Memoized row component to prevent unnecessary re-renders
const TableRowComponent = memo(<T,>({
  index,
  style,
  data
}: ListChildComponentProps<RowData<T>>) => {
  const { items, columns, onRowClick, getRowId } = data;
  const item = items[index];

  if (!item) return null;

  const rowId = getRowId?.(item, index) ?? index.toString();

  return (
    <div style={style}>
      <TableRow
        key={rowId}
        className={cn(
          "flex items-center border-b hover:bg-muted/50 transition-colors",
          onRowClick && "cursor-pointer"
        )}
        onClick={() => onRowClick?.(item, index)}
      >
        {columns.map((column) => (
          <TableCell
            key={column.key}
            className={cn("flex-shrink-0 px-4 py-2", column.className)}
            style={{ width: column.width }}
          >
            {column.render(item, index)}
          </TableCell>
        ))}
      </TableRow>
    </div>
  );
});

TableRowComponent.displayName = 'TableRowComponent';

// Memoized header component
const TableHeaderComponent = memo(<T,>({ columns }: { columns: Column<T>[] }) => (
  <TableHeader className="sticky top-0 z-10 bg-background">
    <TableRow className="flex items-center hover:bg-transparent">
      {columns.map((column) => (
        <TableHead
          key={column.key}
          className={cn("flex-shrink-0 px-4 py-2 font-medium", column.className)}
          style={{ width: column.width }}
        >
          {column.header}
        </TableHead>
      ))}
    </TableRow>
  </TableHeader>
));

TableHeaderComponent.displayName = 'TableHeaderComponent';

// Empty state component
const DefaultEmptyComponent = () => (
  <div className="flex items-center justify-center h-32 text-muted-foreground">
    <p>No data available</p>
  </div>
);

/**
 * VirtualizedTable - High-performance table component for large datasets
 * Only renders visible rows, dramatically improving performance for large lists
 */
function VirtualizedTableComponent<T>({
  data,
  columns,
  height,
  rowHeight = 50,
  className,
  onRowClick,
  getRowId,
  overscanCount = 5,
  EmptyComponent = DefaultEmptyComponent,
}: VirtualizedTableProps<T>) {
  // Calculate total table width
  const totalWidth = useMemo(() =>
    columns.reduce((sum, col) => sum + col.width, 0),
    [columns]
  );

  // Memoize row data to prevent unnecessary re-renders
  const rowData = useMemo((): RowData<T> => ({
    items: data,
    columns,
    onRowClick,
    getRowId,
  }), [data, columns, onRowClick, getRowId]);

  // Show empty state if no data
  if (data.length === 0) {
    return (
      <div className={cn("border rounded-lg", className)}>
        <TableHeaderComponent columns={columns} />
        <EmptyComponent />
      </div>
    );
  }

  // Fallback rendering when react-window is not available
  if (!FixedSizeList) {
    return (
      <div className={cn("border rounded-lg overflow-hidden", className)}>
        <TableHeaderComponent columns={columns} />
        <div style={{ maxHeight: height, overflow: 'auto' }}>
          {data.map((item, index) => (
            <TableRowComponent
              key={getRowId?.(item, index) ?? index}
              index={index}
              style={{ height: rowHeight }}
              data={rowData}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <TableHeaderComponent columns={columns} />
      <div style={{ width: totalWidth, minWidth: '100%' }}>
        <FixedSizeList
          height={height}
          itemCount={data.length}
          itemSize={rowHeight}
          itemData={rowData}
          overscanCount={overscanCount}
          width="100%"
        >
          {TableRowComponent}
        </FixedSizeList>
      </div>
    </div>
  );
}

// Export memoized component
export const VirtualizedTable = memo(VirtualizedTableComponent) as <T>(
  props: VirtualizedTableProps<T>
) => JSX.Element;

export default VirtualizedTable;