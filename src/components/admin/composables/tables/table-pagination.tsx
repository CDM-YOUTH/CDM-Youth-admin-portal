import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export function usePagination<T>(rows: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );
  return {
    page: safePage,
    pageSize,
    totalPages,
    total: rows.length,
    pageRows,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}

type Props = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizes?: number[];
};

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
}: Props) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-2">
      <div className="flex items-center gap-2 text-[10px] text-text-3">
        <span>
          {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
        </span>
        <span className="h-3 w-px bg-border" />
        <label className="flex items-center gap-1.5">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded border border-border bg-bg-3 px-1.5 py-0.5 text-[10px] font-semibold text-text-1 outline-none"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex h-6 w-6 items-center justify-center rounded border border-border bg-bg-3 text-text-2 transition hover:border-gold-3 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        {pageNumbers(page, totalPages).map((entry, index) =>
          entry === "…" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-[10px] text-text-4">
              …
            </span>
          ) : (
            <button
              key={entry}
              onClick={() => onPageChange(entry)}
              className={`h-6 min-w-[1.5rem] rounded px-1.5 text-[10px] font-bold transition ${
                entry === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-bg-3 text-text-2 hover:border-gold-3 hover:text-gold"
              }`}
            >
              {entry}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex h-6 w-6 items-center justify-center rounded border border-border bg-bg-3 text-text-2 transition hover:border-gold-3 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function pageNumbers(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}