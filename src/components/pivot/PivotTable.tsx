import './PivotTable.css';

interface PivotTableProps {
  headers: (string | React.ReactNode)[];
  rows: (string | number | React.ReactNode)[][];
  className?: string;
}

export function PivotTable({ headers, rows, className = '' }: PivotTableProps) {
  return (
    <table className={`data-table ${className}`}>
      <thead>
        <tr>
          {headers.map((header, idx) => (
            <th
              key={idx}
              className={
                typeof header === 'string' && (header.includes('%') || header.toLowerCase().includes('numeric'))
                  ? 'numeric'
                  : ''
              }
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx} className={rowIdx === rows.length - 1 ? 'total-row' : ''}>
            {row.map((cell, cellIdx) => (
              <td
                key={cellIdx}
                className={
                  cellIdx === 0
                    ? 'dim-cell'
                    : typeof cell === 'number' || (typeof cell === 'string' && cell.match(/^\d+%?$/))
                    ? 'numeric'
                    : ''
                }
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

