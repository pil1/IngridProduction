"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { Loader2 } from "lucide-react";

// Define a generic type for table data
type TableDataItem = Record<string, any>;

// Define the structure for column definitions
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

export function ResizableTable<T extends TableDataItem>({
  tableId,
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data available.",
  containerClassName,
  tableClassName,
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

  if (isLoading || isLoadingPreferences) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2 text-muted-foreground">Loading table data...</p>
      </div>
    );
  }

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

  return (
    <div className={cn("w-full overflow-x-auto rounded-md border", containerClassName)}>
      <Table ref={tableRef} className={cn("min-w-full text-sm", tableClassName)}>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="h-8 hover:bg-transparent"> {/* Condensed header row */}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "relative h-8 px-2 py-1 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0",
                  "whitespace-nowrap overflow-hidden text-ellipsis", // Ensure header text truncates
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
                <TableRow key={rowIndex} className="h-8 border-b-0 hover:bg-muted/50"> {/* Condensed data row */}
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