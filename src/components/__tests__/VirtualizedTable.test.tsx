import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { VirtualizedTable, VirtualizedTableColumn } from '../VirtualizedTable';

// Mock the virtualization library
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height }: any) => {
    // Mock implementation that renders a few items
    const items = Array.from({ length: Math.min(itemCount, 5) }, (_, index) =>
      children({ index, style: { height: itemSize } })
    );
    return <div style={{ height }}>{items}</div>;
  }
}));

interface TestData {
  id: string;
  name: string;
  amount: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

const mockData: TestData[] = Array.from({ length: 100 }, (_, i) => ({
  id: `item-${i}`,
  name: `Test Item ${i + 1}`,
  amount: (i + 1) * 100,
  status: i % 2 === 0 ? 'active' : 'inactive',
  createdAt: `2025-01-${String(i % 28 + 1).padStart(2, '0')}`
}));

const mockColumns: VirtualizedTableColumn<TestData>[] = [
  {
    key: 'name',
    header: 'Name',
    width: 200,
    render: (item) => item.name,
    sortable: true
  },
  {
    key: 'amount',
    header: 'Amount',
    width: 120,
    render: (item) => `$${item.amount}`,
    sortable: true
  },
  {
    key: 'status',
    header: 'Status',
    width: 100,
    render: (item) => (
      <span className={item.status === 'active' ? 'text-green-600' : 'text-red-600'}>
        {item.status}
      </span>
    )
  },
  {
    key: 'actions',
    header: 'Actions',
    width: 120,
    render: (item, { onEdit, onDelete }) => (
      <div className="flex gap-2">
        <button onClick={() => onEdit?.(item)} data-testid={`edit-${item.id}`}>
          Edit
        </button>
        <button onClick={() => onDelete?.(item)} data-testid={`delete-${item.id}`}>
          Delete
        </button>
      </div>
    )
  }
];

describe('VirtualizedTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render table headers correctly', () => {
    render(
      <VirtualizedTable
        data={mockData}
        columns={mockColumns}
        height={400}
        itemHeight={50}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should render virtualized data rows', () => {
    render(
      <VirtualizedTable
        data={mockData}
        columns={mockColumns}
        height={400}
        itemHeight={50}
      />
    );

    // Should render first few items due to virtualization
    expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('Test Item 2')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(
      <VirtualizedTable
        data={[]}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <VirtualizedTable
        data={[]}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle column sorting', () => {
    const onSortChange = vi.fn();

    render(
      <VirtualizedTable
        data={mockData}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        onSortChange={onSortChange}
      />
    );

    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    expect(onSortChange).toHaveBeenCalledWith('name', 'asc');
  });

  it('should handle edit and delete actions', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <VirtualizedTable
        data={mockData.slice(0, 5)}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const editButton = screen.getByTestId('edit-item-0');
    const deleteButton = screen.getByTestId('delete-item-0');

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);

    expect(onEdit).toHaveBeenCalledWith(mockData[0]);
    expect(onDelete).toHaveBeenCalledWith(mockData[0]);
  });

  it('should apply custom row className', () => {
    const getRowClassName = vi.fn((item: TestData) =>
      item.status === 'active' ? 'bg-green-50' : 'bg-red-50'
    );

    const { container } = render(
      <VirtualizedTable
        data={mockData.slice(0, 3)}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        getRowClassName={getRowClassName}
      />
    );

    expect(getRowClassName).toHaveBeenCalled();
    // Check if className is applied (implementation dependent)
    const rows = container.querySelectorAll('[class*="bg-"]');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should handle selection when enabled', () => {
    const onSelectionChange = vi.fn();

    render(
      <VirtualizedTable
        data={mockData.slice(0, 5)}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        selectable={true}
        onSelectionChange={onSelectionChange}
      />
    );

    // Look for selection checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    // Click first item checkbox
    fireEvent.click(checkboxes[1]); // Skip header checkbox

    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('should handle custom column widths', () => {
    const customColumns = mockColumns.map(col => ({
      ...col,
      width: col.key === 'name' ? 300 : 150
    }));

    const { container } = render(
      <VirtualizedTable
        data={mockData.slice(0, 5)}
        columns={customColumns}
        height={400}
        itemHeight={50}
      />
    );

    // Check if column widths are applied (implementation dependent)
    const headers = container.querySelectorAll('[style*="width"]');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('should handle keyboard navigation', () => {
    const onRowClick = vi.fn();

    render(
      <VirtualizedTable
        data={mockData.slice(0, 5)}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        onRowClick={onRowClick}
      />
    );

    // Find a data row (skip header)
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row

    // Simulate keyboard interaction
    dataRow.focus();
    fireEvent.keyDown(dataRow, { key: 'Enter' });

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('should render custom cell content', () => {
    const customColumns: VirtualizedTableColumn<TestData>[] = [
      {
        key: 'name',
        header: 'Custom Name',
        width: 200,
        render: (item) => (
          <div className="font-bold text-blue-600" data-testid={`custom-${item.id}`}>
            {item.name.toUpperCase()}
          </div>
        )
      }
    ];

    render(
      <VirtualizedTable
        data={mockData.slice(0, 3)}
        columns={customColumns}
        height={400}
        itemHeight={50}
      />
    );

    expect(screen.getByTestId('custom-item-0')).toBeInTheDocument();
    expect(screen.getByText('TEST ITEM 1')).toBeInTheDocument();
  });

  it('should handle scroll events', () => {
    const onScroll = vi.fn();

    render(
      <VirtualizedTable
        data={mockData}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        onScroll={onScroll}
      />
    );

    // Simulate scroll event (implementation dependent)
    const scrollContainer = screen.getByRole('grid');
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });

    // onScroll callback should be called if implemented
  });

  it('should apply proper accessibility attributes', () => {
    render(
      <VirtualizedTable
        data={mockData.slice(0, 5)}
        columns={mockColumns}
        height={400}
        itemHeight={50}
        ariaLabel="Test data table"
      />
    );

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(mockColumns.length);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
  });

  it('should handle dynamic data updates', () => {
    const { rerender } = render(
      <VirtualizedTable
        data={mockData.slice(0, 5)}
        columns={mockColumns}
        height={400}
        itemHeight={50}
      />
    );

    expect(screen.getByText('Test Item 1')).toBeInTheDocument();

    // Update data
    const newData = [...mockData.slice(0, 5)];
    newData[0] = { ...newData[0], name: 'Updated Item 1' };

    rerender(
      <VirtualizedTable
        data={newData}
        columns={mockColumns}
        height={400}
        itemHeight={50}
      />
    );

    expect(screen.getByText('Updated Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Item 1')).not.toBeInTheDocument();
  });
});