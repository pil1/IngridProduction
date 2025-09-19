"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, truncateText } from "@/lib/utils";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import { VirtualizedTable } from "./VirtualizedTable";
import { Loader2 } from "lucide-react";

/**
 * Generic type for table data items
 * @template T - The type of data displayed in the table
 */
type TableDataItem = Record<string, any>;

/**
 * Configuration for table column definitions
 * @template T - The type of data displayed in the column
 */
export interface TableColumn<T extends TableDataItem> {
  key: string; // Unique key for the column, used for preferences
  header: React.ReactNode;
  // Updated render function signature to accept dynamic props including callbacks
  render: (
    row: T,
    dynamicProps: {
      isSubmitPending?: boolean;
      isDeletePending?: boolean;
      expenseToDeleteId?: string | null;
      onEditClick?: (row: T) => void; // New callback prop
      onSubmitClick?: (id: string) => void; // New callback prop
      onDeleteClick?: (row: T) => void; // New callback prop
      onRowClick?: (row: T) => void; // Added for row click handling
      expandedRowId?: string | null; // Added for expanded row tracking
    }
  ) => React.ReactNode;
  initialWidth?: number; // Optional initial width in pixels
  minWidth?: number; // Minimum width for resizing
  maxWidth?: number; // Maximum width for resizing
  className?: string; // Tailwind classes for the header and cells
  headerClassName?: string; // Tailwind classes specifically for the header
  cellClassName?: string; // Tailwind classes specifically for the cells
}

interface ResizableTableProps<T extends TableDataItem> {
  tableId: string; // Unique identifier for this table instance (for persistence)
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  containerClassName?: string; // Class for the outer div
  tableClassName?: string; // Class for the <table> element
  // Performance optimization options
  enableVirtualization?: boolean; // Enable virtual scrolling for large datasets
  virtualizationThreshold?: number; // Threshold for enabling virtualization (default: 100)
  rowHeight?: number; // Height of each row for virtualization (default: 50)
  maxHeight?: number; // Maximum height of virtualized table (default: 400)
  // New prop: renderRow allows custom rendering of each row, including expandable content
  renderRow?: (
    row: T,
    rowIndex: number,
    columns: TableColumn<T>[],
    columnWidths: Record<string, number>,
    dynamicProps: {
      isSubmitPending?: boolean;
      isDeletePending?: boolean;
      expenseToDeleteId?: string | null;
      onEditClick?: (row: T) => void;
      onSubmitClick?: (id: string) => void;
      onDeleteClick?: (row: T) => void;
      onRowClick?: (row: T) => void; // Added for row click handling
      expandedRowId?: string | null; // Added for expanded row tracking
    }
  ) => React.ReactNode;
  // New props to pass dynamic states and callbacks
  isSubmitPending?: boolean;
  isDeletePending?: boolean;
  expenseToDeleteId?: string | null;
  onEditClick?: (row: T) => void; // New callback prop
  onSubmitClick?: (id: string) => void; // New callback prop
  onDeleteClick?: (row: T) => void; // New callback prop
  onRowClick?: (row: T) => void; // New callback for row clicks
  expandedRowId?: string | null; // New prop to track expanded row
}

const RESIZE_HANDLE_WIDTH = 8; // Width of the resize handle in pixels

/**
 * A highly configurable resizable table component with advanced features
 *
 * This component provides:
 * - Column resizing with persistent preferences
 * - Virtualization for large datasets
 * - Custom row rendering
 * - Dynamic callback support for actions
 * - Loading states and empty states
 * - Responsive design with overflow handling
 *
 * @template T - The type of data items displayed in the table rows
 *
 * @param props - Configuration options for the table
 * @param props.tableId - Unique identifier for persistence of table preferences
 * @param props.columns - Array of column definitions with headers, renderers, and sizing
 * @param props.data - Array of data items to display in the table
 * @param props.isLoading - Whether the table is in loading state (shows spinner)
 * @param props.emptyMessage - Message to display when data array is empty
 * @param props.containerClassName - CSS classes for the table container div
 * @param props.tableClassName - CSS classes for the HTML table element
 * @param props.enableVirtualization - Enable virtual scrolling for performance
 * @param props.virtualizationThreshold - Number of rows to trigger virtualization
 * @param props.rowHeight - Height in pixels of each row for virtualization
 * @param props.maxHeight - Maximum height in pixels for virtualized table
 * @param props.renderRow - Custom row renderer function for complex layouts
 * @param props.isSubmitPending - Whether a submit operation is pending
 * @param props.isDeletePending - Whether a delete operation is pending
 * @param props.expenseToDeleteId - ID of expense being deleted (for UI feedback)
 * @param props.onEditClick - Callback fired when edit action is triggered
 * @param props.onSubmitClick - Callback fired when submit action is triggered
 * @param props.onDeleteClick - Callback fired when delete action is triggered
 * @param props.onRowClick - Callback fired when a row is clicked
 * @param props.expandedRowId - ID of currently expanded row for accordion behavior
 *
 * @returns JSX element representing the complete table with all features
 *
 * @example
 * ```tsx
 * <ResizableTable
 *   tableId="expenses-table"
 *   columns={expenseColumns}
 *   data={expenses}
 *   isLoading={isLoadingExpenses}
 *   emptyMessage="No expenses found"
 *   enableVirtualization={true}
 *   onRowClick={(expense) => setSelectedExpense(expense)}
 * />
 * ```
 */
export function ResizableTable<T extends TableDataItem>({
  tableId,
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data available.",
  containerClassName,
  tableClassName,
  // Performance props
  enableVirtualization = false,
  virtualizationThreshold = 100,
  rowHeight = 50,
  maxHeight = 400,
  renderRow, // Destructure new renderRow prop
  isSubmitPending, // Destructure new props
  isDeletePending, // Destructure new props
  expenseToDeleteId, // Destructure new props
  onEditClick, // Destructure new callback props
  onSubmitClick,
  onDeleteClick,
  onRowClick, // Destructure new row click handler
  expandedRowId, // Destructure new expanded row tracker
}: ResizableTableProps<T>) {
  const { columnWidths, updateColumnWidth, isLoading: isLoadingPreferences } = useTablePreferences(tableId);
  const [currentColumnWidths, setCurrentColumnWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  // Initialize/update currentColumnWidths when preferences or columns change
  useEffect(() => {
    const newWidths: Record<string, number> = {};
    columns.forEach(col => {
      newWidths[col.key] = columnWidths[col.key] || col.initialWidth || 150; // Default to 150px
    });
    setCurrentColumnWidths(newWidths);
  }, [columns, columnWidths]);

  const startResizing = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = currentColumnWidths[columnKey];

    const doResize = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      const min = columns.find(c => c.key === columnKey)?.minWidth || 50;
      const max = columns.find(c => c.key === columnKey)?.maxWidth || Infinity;
      const clampedWidth = Math.max(min, Math.min(max, newWidth));
      setCurrentColumnWidths(prev => ({ ...prev, [columnKey]: clampedWidth }));
    };

    const stopResizing = () => {
      updateColumnWidth(columnKey, currentColumnWidths[columnKey]);
      window.removeEventListener("mousemove", doResize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "default"; // Reset cursor
      document.body.style.userSelect = "auto"; // Re-enable text selection
    };

    window.addEventListener("mousemove", doResize);
    window.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize"; // Change cursor
    document.body.style.userSelect = "none"; // Disable text selection during resize
  }, [currentColumnWidths, updateColumnWidth, columns]);

  // Determine if we should use virtualization - MUST be called before any early returns
  const shouldUseVirtualization = useMemo(() => {
    return enableVirtualization && data.length >= virtualizationThreshold;
  }, [enableVirtualization, data.length, virtualizationThreshold]);

  // Convert ResizableTable columns to VirtualizedTable columns - MUST be called before any early returns
  const virtualizedColumns = useMemo(() => {
    if (!shouldUseVirtualization) return null;

    return columns.map(column => ({
      key: column.key,
      header: column.header as string,
      width: currentColumnWidths[column.key] || column.initialWidth || 150,
      render: (item: T, index: number) => {
        const dynamicProps = {
          isSubmitPending,
          isDeletePending,
          expenseToDeleteId,
          onEditClick,
          onSubmitClick,
          onDeleteClick,
          onRowClick,
          expandedRowId,
        };
        return column.render(item, dynamicProps);
      },
      className: column.className,
    }));
  }, [shouldUseVirtualization, columns, currentColumnWidths, isSubmitPending, isDeletePending, expenseToDeleteId, onEditClick, onSubmitClick, onDeleteClick, onRowClick, expandedRowId]);

  // Dynamic props object - MUST be called before any early returns
  const dynamicProps = useMemo(() => ({
    isSubmitPending,
    isDeletePending,
    expenseToDeleteId,
    onEditClick,
    onSubmitClick,
    onDeleteClick,
    onRowClick,
    expandedRowId,
  }), [isSubmitPending, isDeletePending, expenseToDeleteId, onEditClick, onSubmitClick, onDeleteClick, onRowClick, expandedRowId]);

  // Early returns MUST come after all hooks
  if (isLoading || isLoadingPreferences) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loading-spinner" />
        <p className="ml-2 text-muted-foreground">Loading table data...</p>
      </div>
    );
  }

  // If using virtualization, render VirtualizedTable
  if (shouldUseVirtualization && virtualizedColumns) {
    return (
      <VirtualizedTable
        data={data}
        columns={virtualizedColumns}
        height={maxHeight}
        rowHeight={rowHeight}
        onRowClick={onRowClick}
        className={containerClassName}
      />
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto rounded-md border", containerClassName)}>
      <Table ref={tableRef} className={cn("min-w-full text-sm", tableClassName)}>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="h-8 hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "relative h-8 px-2 py-1 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0",
                  "whitespace-nowrap overflow-hidden text-ellipsis",
                  column.headerClassName,
                  column.className
                )}
                style={{ width: currentColumnWidths[column.key], minWidth: column.minWidth || 50 }}
              >
                <div className="flex items-center h-full">
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {column.header}
                  </span>
                  <div
                    className="absolute right-0 top-0 h-full cursor-col-resize bg-transparent hover:bg-border"
                    style={{ width: RESIZE_HANDLE_WIDTH, transform: `translateX(${RESIZE_HANDLE_WIDTH / 2}px)` }}
                    onMouseDown={(e) => startResizing(e, column.key)}
                  />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="h-8 hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-8 text-center text-muted-foreground px-2 py-1">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIndex) => (
              renderRow ? (
                renderRow(row, rowIndex, columns, currentColumnWidths, dynamicProps)
              ) : (
                // Default row rendering (existing logic)
                <TableRow key={rowIndex} className="h-8 border-b-0 hover:bg-muted/50">
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "h-8 px-2 py-1 align-middle [&:has([role=checkbox])]:pr-0",
                        "whitespace-nowrap overflow-hidden text-ellipsis", // Truncate cell content
                        column.cellClassName,
                        column.className
                      )}
                      style={{ width: currentColumnWidths[column.key], minWidth: column.minWidth || 50 }}
                      title={typeof column.render(row, dynamicProps) === 'string' ? column.render(row, dynamicProps) as string : undefined} // Show full text on hover
                    >
                      {/* Pass dynamic props to the render function */}
                      {truncateText(column.render(row, dynamicProps), currentColumnWidths[column.key] - (RESIZE_HANDLE_WIDTH + 10))} {/* Adjust for padding and handle */}
                    </TableCell>
                  ))}
                </TableRow>
              )
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}