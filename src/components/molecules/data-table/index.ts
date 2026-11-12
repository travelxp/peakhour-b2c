export { DataTable } from "./data-table";
export { DataTableColumnHeader } from "./column-header";
export { DataTablePagination } from "./pagination";
export { DataTableToolbar } from "./toolbar";
// DataToolbar is NOT re-exported here on purpose: import it from "./data-toolbar" directly. Through this barrel it
// pulled the whole TanStack data-table into pages that only render a toolbar (~93 KB; Content and Connected
// accounts went over the 10% bundle budget, 2026-11-10).
export { FacetedFilter, type FacetedFilterOption } from "./faceted-filter";
export { useDataTable, type UseDataTableOptions } from "./use-data-table";
