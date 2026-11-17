import React from "react";

import { cn } from "@/lib/utils";
import { Table } from "@/components/ui/table";

export interface OwnerTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  label: string;
}

export function OwnerTable({ label, className, children, ...props }: OwnerTableProps) {
  return (
    <Table
      {...props}
      scrollRegionLabel={label}
      className={cn(
        "min-w-[40rem] text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2",
        className,
      )}
    >
      {children}
    </Table>
  );
}
