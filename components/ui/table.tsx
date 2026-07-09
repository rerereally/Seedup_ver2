import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full caption-bottom text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHeader({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`border-b border-outline-soft ${className}`} {...props} />;
}

export function TableBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />;
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-outline-soft transition-colors hover:bg-surface ${className}`} {...props} />;
}

export function TableHead({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`h-10 px-3 text-left align-middle text-xs font-black uppercase text-muted ${className}`} {...props} />;
}

export function TableCell({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-3 py-3 align-middle text-sm text-ink ${className}`} {...props} />;
}
