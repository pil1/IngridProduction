import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  mobileRender?: (item: T) => ReactNode;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  mobileCardRender?: (item: T) => ReactNode;
  emptyMessage?: string;
  loading?: boolean;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  mobileCardRender,
  emptyMessage = "No data available",
  loading = false,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (isMobile && mobileCardRender) {
    return (
      <div className="space-y-4">
        {data.map((item) => (
          <Card key={keyExtractor(item)} className="p-4">
            <CardContent className="p-0">
              {mobileCardRender(item)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isMobile) {
    // Default mobile rendering using first few columns
    return (
      <div className="space-y-4">
        {data.map((item) => (
          <Card key={keyExtractor(item)} className="p-4">
            <CardContent className="p-0 space-y-2">
              {columns.slice(0, 4).map((column) => (
                <div key={column.key} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">
                    {column.header}:
                  </span>
                  <div className="text-sm">
                    {column.mobileRender ? column.mobileRender(item) : column.render(item)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop table rendering
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={keyExtractor(item)}>
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}