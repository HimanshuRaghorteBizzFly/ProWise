"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Pure paging math used by `usePagedRows`: clamps the requested page to 1..totalPages and returns that page's rows.
 * An empty list still has one (empty) page.
 */
export function pageOf<T>(rows: readonly T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return { page, totalPages, pageRows: rows.slice((page - 1) * pageSize, page * pageSize) };
}

/**
 * Client-side paging for a loaded list, shared by every Super Admin table: returns the rows of the current page and
 * the props for `PaginationBar` ("Showing 1–5 of N", Rows per page, Prev / page / Next). The page goes back to 1 when
 * the list or page size changes, and never points past the last page.
 */
export function usePagedRows<T>(rows: readonly T[], defaultPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const totalItems = rows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems, pageSize]);

  const { page, totalPages, pageRows } = useMemo(() => pageOf(rows, currentPage, pageSize), [rows, currentPage, pageSize]);

  return {
    pageRows,
    barProps: {
      currentPage: page,
      totalItems,
      pageSize,
      onPageChange: (next: number) => setCurrentPage(Math.min(Math.max(1, next), totalPages)),
      onPageSizeChange: (size: number) => setPageSize(size),
    },
  };
}
