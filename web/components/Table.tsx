import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm">{children}</table>
  </div>
);

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '' }) => (
  <thead>
    <tr className={`border-b border-gray-700 bg-gray-900 ${className}`}>
      {children}
    </tr>
  </thead>
);

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => (
  <tbody className={className}>{children}</tbody>
);

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  clickable?: boolean;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = '',
  clickable = false,
  onClick,
}) => (
  <tr
    className={`border-b border-gray-800 ${
      clickable ? 'hover:bg-gray-800 cursor-pointer transition' : ''
    } ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  onSort?: () => void;
}

export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({
  children,
  className = '',
  sortable = false,
  onSort,
}) => (
  <th
    className={`px-6 py-4 text-left font-semibold text-gray-300 ${
      sortable ? 'cursor-pointer hover:text-cyan-400 select-none' : ''
    } ${className}`}
    onClick={onSort}
  >
    {children}
  </th>
);

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = '',
  align = 'left',
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return (
    <td className={`px-6 py-4 ${alignClass} ${className}`}>{children}</td>
  );
};

export default Table;
