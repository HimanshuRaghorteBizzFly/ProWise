/**
 * Single re-export of the Super Admin presentation primitives used by Owner/Admin pages.
 * Nothing is copied or moved; these components depend only on `cn` and lucide icons.
 */
export {
  PageHeader,
  SurfaceCard,
  StatusBadge,
  getStatusTone,
  FilterBar,
  PaginationBar,
  TableSkeleton,
  EmptyStateView,
  ErrorBanner,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
export type { PageHeaderProps, FilterBarProps, StatusTone } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
