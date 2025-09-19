import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { ResizableTable, TableColumn } from '../ResizableTable';

// Mock the table preferences hook
vi.mock('@/hooks/use-table-preferences', () => ({
  useTablePreferences: () => ({
    columnWidths: { name: 150, amount: 100, date: 120 },
    updateColumnWidth: vi.fn(),
    isLoading: false
  })
}));

interface TestData {
  id: string;
  name: string;
  amount: number;
  date: string;
}

const mockData: TestData[] = [
  { id: '1', name: 'Test Item 1', amount: 100, date: '2025-01-01' },
  { id: '2', name: 'Test Item 2', amount: 200, date: '2025-01-02' },
  { id: '3', name: 'Test Item 3', amount: 300, date: '2025-01-03' }
];

const mockColumns: TableColumn<TestData>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => row.name,
    minWidth: 100
  },
  {
    key: 'amount',
    header: 'Amount',
    render: (row) => `$${row.amount}`,
    minWidth: 80
  },
  {
    key: 'date',
    header: 'Date',
    render: (row) => row.date,
    minWidth: 100
  }
];

describe('ResizableTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render table with data', () => {
    render(
      <ResizableTable
        tableId="test-table"
        columns={mockColumns}
        data={mockData}
      />
    );

    // Check headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();

    // Check data rows
    expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('2025-01-01')).toBeInTheDocument();

    expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText('2025-01-02')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <ResizableTable
        tableId="test-table"
        columns={mockColumns}
        data={[]}
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading table data...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show empty message when no data', () => {
    render(
      <ResizableTable
        tableId="test-table"
        columns={mockColumns}
        data={[]}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ResizableTable
        tableId="test-table"
        columns={mockColumns}
        data={mockData}
        containerClassName="custom-container"
        tableClassName="custom-table"
      />
    );

    const containerDiv = container.querySelector('.custom-container');
    const table = container.querySelector('.custom-table');

    expect(containerDiv).toBeInTheDocument();
    expect(table).toBeInTheDocument();
  });

  it('should handle row click when provided', () => {
    const onRowClick = vi.fn();

    const columnsWithRowClick: TableColumn<TestData>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row, { onRowClick }) => (
          <button onClick={() => onRowClick?.(row)}>
            {row.name}
          </button>
        )
      }
    ];

    render(
      <ResizableTable
        tableId="test-table"
        columns={columnsWithRowClick}
        data={[mockData[0]]}
        onRowClick={onRowClick}
      />
    );

    const button = screen.getByRole('button', { name: 'Test Item 1' });
    fireEvent.click(button);

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('should handle edit and delete callbacks', () => {
    const onEditClick = vi.fn();
    const onDeleteClick = vi.fn();

    const columnsWithActions: TableColumn<TestData>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row, { onEditClick, onDeleteClick }) => (
          <div>
            <button onClick={() => onEditClick?.(row)}>Edit</button>
            <button onClick={() => onDeleteClick?.(row)}>Delete</button>
          </div>
        )
      }
    ];

    render(
      <ResizableTable
        tableId="test-table"
        columns={columnsWithActions}
        data={[mockData[0]]}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
    );

    const editButton = screen.getByRole('button', { name: 'Edit' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);

    expect(onEditClick).toHaveBeenCalledWith(mockData[0]);
    expect(onDeleteClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('should handle submit pending state', () => {
    const columnsWithSubmit: TableColumn<TestData>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row, { isSubmitPending, onSubmitClick }) => (
          <button
            onClick={() => onSubmitClick?.(row.id)}
            disabled={isSubmitPending}
          >
            {isSubmitPending ? 'Submitting...' : 'Submit'}
          </button>
        )
      }
    ];

    const onSubmitClick = vi.fn();

    render(
      <ResizableTable
        tableId="test-table"
        columns={columnsWithSubmit}
        data={[mockData[0]]}
        onSubmitClick={onSubmitClick}
        isSubmitPending={true}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Submitting...' });
    expect(submitButton).toBeDisabled();
  });

  it('should use custom render row function', () => {
    const customRenderRow = (
      row: TestData,
      rowIndex: number,
      columns: TableColumn<TestData>[],
      columnWidths: Record<string, number>
    ) => (
      <tr key={row.id} data-testid={`custom-row-${rowIndex}`}>
        <td colSpan={columns.length}>
          Custom: {row.name} - ${row.amount}
        </td>
      </tr>
    );

    render(
      <ResizableTable
        tableId="test-table"
        columns={mockColumns}
        data={[mockData[0]]}
        renderRow={customRenderRow}
      />
    );

    expect(screen.getByTestId('custom-row-0')).toBeInTheDocument();
    expect(screen.getByText('Custom: Test Item 1 - $100')).toBeInTheDocument();
  });

  it('should apply column-specific CSS classes', () => {
    const columnsWithClasses: TableColumn<TestData>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name,
        className: 'name-column',
        headerClassName: 'name-header',
        cellClassName: 'name-cell'
      }
    ];

    const { container } = render(
      <ResizableTable
        tableId="test-table"
        columns={columnsWithClasses}
        data={[mockData[0]]}
      />
    );

    const header = container.querySelector('th.name-column.name-header');
    const cell = container.querySelector('td.name-column.name-cell');

    expect(header).toBeInTheDocument();
    expect(cell).toBeInTheDocument();
  });
});