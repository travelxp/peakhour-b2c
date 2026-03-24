"use client";

import {
  type Column,
  type ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  RowSelectionState,
  type SortingState,
  type Table as TableType,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  CheckCheckIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Clock,
  Footprints,
  ListFilterIcon,
  LoaderIcon,
  Package,
  PackageIcon,
  PieChart,
  RefreshCcw,
  Shirt,
  ShoppingBag,
  Smartphone,
} from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type UseDataTableOptions<TData> = {
  data: Array<TData>;
  columns: Array<ColumnDef<TData, unknown>>;
  getRowId?: (row: TData) => string;
  initialSorting?: SortingState;
  initialGlobalFilter?: string;
  initialFilters?: ColumnFiltersState;
  initialVisibility?: VisibilityState;
  initialSelection?: RowSelectionState;
  enableRowSelection?: boolean;
};
export function useDataTable<TData>(options: UseDataTableOptions<TData>) {
  const {
    data,
    columns,
    getRowId,
    initialSorting = [],
    initialFilters = [],
    initialGlobalFilter = "",
    initialVisibility = {},
    initialSelection = {},
    enableRowSelection = true,
  } = options;

  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialFilters);
  const [globalFilter, setGlobalFilter] =
    React.useState<string>(initialGlobalFilter);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialVisibility);
  const [rowSelection, setRowSelection] =
    React.useState<RowSelectionState>(initialSelection);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableRowSelection,
  });

  return {
    table,
    columnFilters,
    setColumnFilters,
    sorting,
    setSorting,
    globalFilter,
    setGlobalFilter,
    columnVisibility,
    setColumnVisibility,
    rowSelection,
    setRowSelection,
  };
}

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
};

export const DataTableColumnHeader = <TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) => {
  const canSort = column.getCanSort();
  const sorted = column.getIsSorted();

  if (!canSort) {
    return (
      <span className="flex h-8 items-center text-sm font-medium text-foreground">
        {title}
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex h-8 items-center gap-2 px-0 text-sm font-medium text-foreground"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span>{title}</span>
      {sorted === "desc" ? (
        <ArrowDown className="h-4 w-4" />
      ) : sorted === "asc" ? (
        <ArrowUp className="h-4 w-4" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      )}
    </Button>
  );
};

type DataTablePaginationProps<TData> = {
  table: TableType<TData>;
  pageSizeOptions?: number[];
};

export const DataTablePagination = <TData,>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
}: DataTablePaginationProps<TData>) => {
  const currentPage = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  const startRow = currentPage * pageSize + 1;
  const endRow = Math.min((currentPage + 1) * pageSize, totalRows);

  const relevantPageSizes = pageSizeOptions.filter(
    (size) => size <= totalRows || size === pageSize,
  );

  return (
    <div className="flex flex-col gap-4 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 text-center text-sm text-muted-foreground sm:text-left">
        <span className="font-medium">
          {totalRows === 0 ? (
            "No results"
          ) : (
            <>
              Showing {startRow} to {endRow} of {totalRows}{" "}
              {totalRows === 1 ? "row" : "rows"}
            </>
          )}
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium whitespace-nowrap">Rows per page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
            disabled={totalRows === 0}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {relevantPageSizes.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm font-medium whitespace-nowrap">
            Page {currentPage + 1} of {pageCount}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={currentPage === 0 || totalRows === 0}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Go to next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 lg:flex"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={currentPage === pageCount - 1 || totalRows === 0}
              aria-label="Go to last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DataTableButtonFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface DataTableButtonFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: DataTableButtonFilterOption[];
  align?: "start" | "center" | "end";
}

export function DataTableButtonFilter<TData, TValue>({
  column,
  title = "Filter",
  options,
  align = "end",
}: DataTableButtonFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();

  const facetCounts = React.useMemo(() => {
    if (!facets || !column) return null;
    const map = new Map<string, number>();
    facets.forEach((count, key) => {
      const numeric = Number(count);
      const stringKey = String(key);
      map.set(stringKey, numeric);
      map.set(stringKey.toLowerCase(), numeric);
    });
    return map;
  }, [facets, column]);

  const filterValue = column?.getFilterValue();
  const selectedValues = React.useMemo(() => {
    if (filterValue == null) return new Set<string>();
    const values = Array.isArray(filterValue)
      ? filterValue.filter(Boolean).map(String)
      : [String(filterValue)];
    return new Set(values.map((value) => value.toLowerCase()));
  }, [filterValue]);
  const selectedCount = selectedValues.size;

  const handleValueChange = React.useCallback(
    (value: string, checked: boolean) => {
      if (!column) return;
      const currentValue = column.getFilterValue();
      const raw = Array.isArray(currentValue)
        ? currentValue.map(String)
        : currentValue
          ? [String(currentValue)]
          : [];
      const next = new Set(raw);

      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }

      column.setFilterValue(next.size ? Array.from(next) : undefined);
    },
    [column],
  );

  const clearFilters = React.useCallback(() => {
    if (!column) return;
    column.setFilterValue(undefined);
  }, [column]);

  if (!column) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-2 px-3", selectedCount > 0 && "bg-primary/5")}
        >
          <ListFilterIcon className="size-4" />
          <span className="text-sm font-medium">Filter</span>
          {selectedCount > 0 && (
            <Badge
              variant="secondary"
              className="rounded-sm px-1 text-[11px] font-normal"
            >
              {selectedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto min-w-36 space-y-3"
        sideOffset={8}
      >
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground/70 uppercase">
            {title}
          </p>
          <div className="space-y-2">
            {options.map((option, index) => {
              const checkboxId = `${column.id ?? "filter"}-${index}`;
              const isSelected = selectedValues.has(option.value.toLowerCase());
              const OptionIcon = option.icon;
              const count =
                facetCounts?.get(option.value) ??
                facetCounts?.get(option.value.toLowerCase());

              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                    isSelected ? "bg-muted" : "hover:bg-muted/70",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleValueChange(option.value, Boolean(checked))
                    }
                    aria-label={`Toggle ${option.label}`}
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="flex w-full items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {OptionIcon && (
                        <OptionIcon className="size-3.5 text-muted-foreground" />
                      )}
                      {option.label}
                    </span>
                    {typeof count === "number" && !Number.isNaN(count) && (
                      <span className="text-xs text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className={cn(
            "h-8 w-full justify-center rounded-md border-dashed bg-muted/40 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
            selectedCount === 0 &&
              "border-muted/40 bg-muted/10 text-muted-foreground/70",
          )}
          onClick={clearFilters}
          disabled={selectedCount === 0}
        >
          Clear filters
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface DataTableTabbarProps<TData> extends React.ComponentProps<"div"> {
  _table: TableType<TData>;
  search?: React.ReactNode;
  filter?: React.ReactNode;
}
export function DataTableTabbar<TData>({
  _table,
  children,
  search,
  filter,
  className,
  ...props
}: DataTableTabbarProps<TData>) {
  return (
    <div
      className={cn("flex items-center justify-between py-4", className)}
      {...props}
    >
      <div className="flex flex-1 items-center gap-2">{children}</div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {search}
        {filter}
      </div>
    </div>
  );
}

export const schema = z.object({
  id: z.string(),
  purchased: z.string(),
  order_status: z.string(),
  customer: z.string(),
  payment_method: z.string(),
  payment_status: z.string(),
  items: z.number(),
});

const data = [
  {
    id: "#301456",
    purchased: "Leather Jacket",
    order_status: "Ready for pickup",
    customer: "Sarah Johnson",
    payment_method: "****7321",
    payment_status: "Paid",
    items: 3,
  },
  {
    id: "#789123",
    purchased: "Blue Sneakers",
    order_status: "Fulfilled",
    customer: "Michael Brown",
    payment_method: "****4509",
    payment_status: "Paid",
    items: 2,
  },
  {
    id: "#654321",
    purchased: "Red Hoodie",
    order_status: "Fulfilled",
    customer: "Emily Davis",
    payment_method: "****9812",
    payment_status: "Pending",
    items: 4,
  },
  {
    id: "#987654",
    purchased: "Black Sunglasses",
    order_status: "Unfulfilled",
    customer: "David Lee",
    payment_method: "****6734",
    payment_status: "Pending",
    items: 1,
  },
  {
    id: "#432187",
    purchased: "Green Backpack",
    order_status: "Fulfilled",
    customer: "Lisa Wang",
    payment_method: "****2901",
    payment_status: "Paid",
    items: 2,
  },
  {
    id: "#567890",
    purchased: "Silver Watch",
    order_status: "Ready for pickup",
    customer: "James Carter",
    payment_method: "****8456",
    payment_status: "Pending",
    items: 1,
  },
  {
    id: "#234567",
    purchased: "Gray Scarf",
    order_status: "Fulfilled",
    customer: "Rachel Kim",
    payment_method: "****1234",
    payment_status: "Refunded",
    items: 3,
  },
  {
    id: "#876543",
    purchased: "Purple Dress",
    order_status: "Unfulfilled",
    customer: "Thomas Allen",
    payment_method: "****5678",
    payment_status: "Partially refunded",
    items: 2,
  },
  {
    id: "#345678",
    purchased: "White Hat",
    order_status: "Ready for pickup",
    customer: "Anna Patel",
    payment_method: "****9012",
    payment_status: "Paid",
    items: 1,
  },
  {
    id: "#456789",
    purchased: "Brown Boots",
    order_status: "Fulfilled",
    customer: "Robert Singh",
    payment_method: "****3456",
    payment_status: "Paid",
    items: 4,
  },
  {
    id: "#678901",
    purchased: "Yellow Tote Bag",
    order_status: "Fulfilled",
    customer: "Sophie Turner",
    payment_method: "****7890",
    payment_status: "Pending",
    items: 2,
  },
  {
    id: "#890123",
    purchased: "Orange Gloves",
    order_status: "Unfulfilled",
    customer: "Henry Clark",
    payment_method: "****2345",
    payment_status: "Pending",
    items: 1,
  },
  {
    id: "#123456",
    purchased: "Pink Sweater",
    order_status: "Ready for pickup",
    customer: "Grace Evans",
    payment_method: "****6789",
    payment_status: "Paid",
    items: 3,
  },
  {
    id: "#543210",
    purchased: "Black Belt",
    order_status: "Fulfilled",
    customer: "Daniel Moore",
    payment_method: "****1122",
    payment_status: "Refunded",
    items: 1,
  },
  {
    id: "#765432",
    purchased: "Teal Jacket",
    order_status: "Unfulfilled",
    customer: "Olivia White",
    payment_method: "****5566",
    payment_status: "Partially refunded",
    items: 2,
  },
  {
    id: "#987012",
    purchased: "Navy Shorts",
    order_status: "Ready for pickup",
    customer: "Ethan Gray",
    payment_method: "****9900",
    payment_status: "Pending",
    items: 5,
  },
  {
    id: "#210987",
    purchased: "Gold Necklace",
    order_status: "Fulfilled",
    customer: "Megan Scott",
    payment_method: "****3344",
    payment_status: "Paid",
    items: 1,
  },
  {
    id: "#432109",
    purchased: "Olive Pants",
    order_status: "Fulfilled",
    customer: "Jacob Hill",
    payment_method: "****7788",
    payment_status: "Paid",
    items: 3,
  },
  {
    id: "#6543210",
    purchased: "Red Cap",
    order_status: "Unfulfilled",
    customer: "Chloe Young",
    payment_method: "****1122",
    payment_status: "Pending",
    items: 1,
  },
  {
    id: "#8765432",
    purchased: "Blue Jeans",
    order_status: "Ready for pickup",
    customer: "Noah Lewis",
    payment_method: "****5566",
    payment_status: "Paid",
    items: 2,
  },
  {
    id: "#109876",
    purchased: "Green Shirt",
    order_status: "Fulfilled",
    customer: "Ava King",
    payment_method: "****9900",
    payment_status: "Refunded",
    items: 4,
  },
  {
    id: "#321098",
    purchased: "Purple Skirt",
    order_status: "Unfulfilled",
    customer: "Liam Adams",
    payment_method: "****3344",
    payment_status: "Partially refunded",
    items: 1,
  },
  {
    id: "#5432109",
    purchased: "Black Wallet",
    order_status: "Ready for pickup",
    customer: "Isabella Baker",
    payment_method: "****7788",
    payment_status: "Pending",
    items: 2,
  },
  {
    id: "#7654321",
    purchased: "Yellow Scarf",
    order_status: "Fulfilled",
    customer: "Mason Green",
    payment_method: "****1122",
    payment_status: "Paid",
    items: 1,
  },
  {
    id: "#9876543",
    purchased: "White Sneakers",
    order_status: "Fulfilled",
    customer: "Ella Martinez",
    payment_method: "****5566",
    payment_status: "Paid",
    items: 3,
  },
];

export type StatusOption = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export const productTypes = [
  {
    value: "electronics",
    label: "Electronics",
    icon: Smartphone,
  },
  {
    value: "accessories",
    label: "Accessories",
    icon: ShoppingBag,
  },
  {
    value: "clothing",
    label: "Clothing",
    icon: Shirt,
  },
  {
    value: "footwear",
    label: "Footwear",
    icon: Footprints,
  },
  {
    value: "shoes",
    label: "Shoes",
    icon: PackageIcon,
  },
];

export const orderStatuses: StatusOption[] = [
  { label: "Fulfilled", value: "Fulfilled", icon: CheckCircle },
  { label: "Ready for pickup", value: "Ready for pickup", icon: Package },
  { label: "Unfulfilled", value: "Unfulfilled", icon: Clock },
];

export const paymentStatuses: StatusOption[] = [
  { label: "Paid", value: "Paid", icon: CheckCheckIcon },
  { label: "Pending", value: "Pending", icon: LoaderIcon },
  { label: "Refunded", value: "Refunded", icon: RefreshCcw },
  {
    label: "Partially refunded",
    value: "Partially refunded",
    icon: PieChart,
  },
];

const createStatusLookup = (options: StatusOption[]) =>
  options.reduce<Record<string, StatusOption>>((acc, option) => {
    acc[option.value] = option;
    return acc;
  }, {});

const orderStatusLookup = createStatusLookup(orderStatuses);
const paymentStatusLookup = createStatusLookup(paymentStatuses);

export const getOrderStatusMeta = (status: string) => orderStatusLookup[status];

export const getPaymentStatusMeta = (status: string) =>
  paymentStatusLookup[status];

export const getStatusVariant = (status: string) => {
  switch (status) {
    case "Fulfilled":
      return "default";
    case "Ready for pickup":
      return "secondary";
    case "Unfulfilled":
      return "outline";
    default:
      return "outline";
  }
};

export const getPaymentVariant = (status: string) => {
  switch (status) {
    case "Paid":
      return "default";
    case "Pending":
      return "secondary";
    case "Refunded":
      return "outline";
    case "Partially refunded":
      return "outline";
    default:
      return "outline";
  }
};
type OrderStatusTab = "all" | string;

export const validatedData = schema.array().parse(data);

export const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    accessorKey: "order",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order" />
    ),
    cell: ({ row }) => (
      <div className="w-[100px] font-mono">{row.original.id}</div>
    ),
    enableHiding: false,
    meta: {
      label: "Order",
    },
  },
  {
    accessorKey: "purchased",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Purchased" />
    ),
    cell: ({ row }) => {
      const items = row.original.items;

      return (
        <div className="flex gap-2">
          <div className="max-w-[500px] truncate font-medium">
            {row.original.purchased}
          </div>
          {items && <Badge variant="outline">{items}</Badge>}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      label: "Purchased",
    },
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <div className="max-w-[150px] truncate">{row.original.customer}</div>
    ),
    meta: {
      label: "Customer",
    },
  },
  {
    accessorKey: "order_status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.order_status;
      const statusMeta = getOrderStatusMeta(status);
      const StatusIcon = statusMeta?.icon;

      return (
        <div className="flex items-center gap-2">
          <Badge
            variant={getStatusVariant(status)}
            className="gap-1 whitespace-nowrap"
          >
            {StatusIcon && <StatusIcon className="size-3" />}
            <span>{statusMeta?.label ?? status}</span>
          </Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return true;
      }
      const rowValue = String(row.getValue(id)).toLowerCase();
      return value
        .map(String)
        .some((entry) => entry.toLowerCase() === rowValue);
    },
    enableSorting: false,
    meta: {
      label: "Order Status",
    },
  },
  {
    accessorKey: "payment_status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.payment_status;
      const statusMeta = getPaymentStatusMeta(status);
      const StatusIcon = statusMeta?.icon;

      return (
        <div className="flex items-center gap-2">
          <Badge
            variant={getPaymentVariant(status)}
            className="gap-1 whitespace-nowrap"
          >
            {StatusIcon && <StatusIcon className="size-3" />}
            <span>{statusMeta?.label ?? status}</span>
          </Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return true;
      }
      const rowValue = String(row.getValue(id)).toLowerCase();
      return value
        .map(String)
        .some((entry) => entry.toLowerCase() === rowValue);
    },
    enableSorting: false,
    meta: {
      label: "Payment Status",
    },
  },

  {
    accessorKey: "payment_method",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Method" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-sm">{row.original.payment_method}</div>
    ),
    enableSorting: false,
    meta: {
      label: "Payment Method",
    },
  },
];

export const DataTable14 = ({ className }: { className?: string }) => {
  const { table, setColumnFilters } = useDataTable({
    data: validatedData,
    columns,
    getRowId: (row) => row.id.toString(),
  });

  const orderStatusColumn = table.getColumn("order_status");
  const paymentStatusColumn = table.getColumn("payment_status");

  const [orderStatusTab, setOrderStatusTab] =
    React.useState<OrderStatusTab>("all");

  const orderStatusCounts = React.useMemo(
    () => orderStatusColumn?.getFacetedUniqueValues(),
    [orderStatusColumn],
  );

  const allOrdersCount = React.useMemo(() => {
    if (!orderStatusCounts?.size) {
      return table.getPreFilteredRowModel().rows.length;
    }
    return Array.from(orderStatusCounts.values()).reduce(
      (acc, count) => acc + Number(count),
      0,
    );
  }, [orderStatusCounts, table]);

  // Single unified handler for status tab changes
  const handleStatusTabChange = React.useCallback(
    (value: string) => {
      setOrderStatusTab(value);
      setColumnFilters((prev) => {
        const filtered = prev.filter((f) => f.id !== "order_status");
        return value === "all"
          ? filtered
          : [...filtered, { id: "order_status", value: [value] }];
      });
    },
    [setColumnFilters],
  );

  const PaymentStatusFilter = paymentStatusColumn ? (
    <DataTableButtonFilter
      column={paymentStatusColumn}
      options={paymentStatuses}
      title="Payment Status"
      align="end"
    />
  ) : null;

  const Search = (
    <Input
      placeholder="Search anything..."
      value={(table.getState().globalFilter as string) ?? ""}
      onChange={(event) => table.setGlobalFilter(event.target.value)}
      className="h-8 w-full lg:w-[250px]"
    />
  );

  const Toolbar = (
    <DataTableTabbar
      _table={table}
      search={Search}
      filter={PaymentStatusFilter}
      className="flex-wrap gap-y-2"
    >
      {orderStatusColumn && (
        <Tabs
          value={orderStatusTab}
          onValueChange={handleStatusTabChange}
          className="w-full min-w-[260px] sm:w-auto"
        >
          <TabsList
            className="flex w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto"
            role="tablist"
            aria-label="Filter orders by status"
          >
            <TabsTrigger value="all" className="gap-2">
              <span>All</span>
              <Badge variant="secondary" className="rounded-sm px-1.5">
                {allOrdersCount}
              </Badge>
            </TabsTrigger>
            {orderStatuses.map((status) => {
              const StatusIcon = status.icon;
              const count = orderStatusCounts?.get(status.value) ?? 0;
              return (
                <TabsTrigger
                  key={status.value}
                  value={status.value}
                  className="gap-2"
                >
                  {StatusIcon && <StatusIcon className="size-3" />}
                  <span className="hidden text-xs md:inline">
                    {status.label}
                  </span>
                  <Badge variant="secondary" className="rounded-sm px-1.5">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}
    </DataTableTabbar>
  );

  return (
    <section className={cn("w-full py-32 lg:w-auto", className)}>
      <div className="container">
        <div className="w-full">
          <div className="mb-8 text-left">
            <h2 className="text-2xl font-bold tracking-tight">
              Data Table With Tabbed Filters and Button Filter
            </h2>
            <p className="mt-2 text-muted-foreground">
              A feature-rich data table with sorting, global filtering, hideable
              columns, Tabbed filters and full pagination controls with
              responsive design.
            </p>
          </div>
          {Toolbar}
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} />
        </div>
      </div>
    </section>
  );
};
