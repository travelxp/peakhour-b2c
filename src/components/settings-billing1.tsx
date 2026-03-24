import { Download, Info } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsageItem {
  title: string;
  usage: number;
  total: number;
  tag?: string;
  info?: string;
  actionButtonText?: string;
  actionButtonLink?: string;
}

interface BillingDetailItem {
  label: string;
  value: string;
}

interface InvoiceItem {
  reference: string;
  totalInclTax: string;
  status: "Paid" | "Pending";
  date: string;
}

interface ColumnItem {
  header: string;
  accessorKey: keyof InvoiceItem;
  cell?: (value: InvoiceItem[keyof InvoiceItem], row: InvoiceItem) => ReactNode;
}

interface UsageCardProps {
  usage: UsageItem;
  className?: string;
}

const UsageCard = ({ usage, className }: UsageCardProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border bg-muted/30 px-4 pt-3 pb-5",
        className,
      )}
    >
      <div className="mb-1.5 flex flex-col justify-between gap-2 leading-tight sm:mb-0 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{usage.title}</p>
          {usage.tag && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {usage.tag}
            </Badge>
          )}
        </div>
        {usage.actionButtonText && (
          <a href={usage.actionButtonLink}>
            <Button variant="outline" size="sm">
              {usage.actionButtonText}
            </Button>
          </a>
        )}
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        <span className="text-foreground">{usage.usage} used</span> /{" "}
        {usage.total} included
      </p>

      <div className="relative mt-2 h-1 w-full rounded-full bg-muted">
        <span
          style={{
            width: `${(usage.usage / usage.total) * 100}%`,
            backgroundColor: `color-mix(in srgb, green ${100 - (usage.usage / usage.total) * 100}%, orange ${(usage.usage / usage.total) * 100}%)`,
          }}
          className="absolute top-0 left-0 h-full rounded-full"
        ></span>
      </div>

      {usage.info && (
        <div className="mt-3 inline-flex items-center gap-1 text-muted-foreground">
          <Info className="size-3.5" />
          <p className="text-xs">{usage.info}</p>
        </div>
      )}
    </div>
  );
};

interface BillingDetailCardProps {
  detail: BillingDetailItem;
  className?: string;
}

const BillingDetailCard = ({ detail, className }: BillingDetailCardProps) => {
  return (
    <div
      className={cn("flex flex-col gap-0.5 text-sm font-semibold", className)}
    >
      <p>{detail.label}</p>
      <p className="font-medium text-muted-foreground">{detail.value}</p>
    </div>
  );
};

interface DataTableProps {
  columns: ColumnItem[];
  data: InvoiceItem[];
  actions?: (row: InvoiceItem) => ReactNode;
}

const DataTable = ({ columns, data, actions }: DataTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column, i) => (
            <TableHead key={`header-${column.accessorKey}-${i}`}>
              {column.header}
            </TableHead>
          ))}
          {actions && <TableHead></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={`row-${i}`}>
            {columns.map((column, j) => {
              const value = row[column.accessorKey];
              return (
                <TableCell key={`cell-${column.accessorKey}-${i}-${j}`}>
                  {column.cell ? column.cell(value, row) : value}
                </TableCell>
              );
            })}
            {actions && <TableCell>{actions(row)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

interface SettingsBilling1Props {
  usages: UsageItem[];
  billingDetails: BillingDetailItem[];
  invoices: InvoiceItem[];
  invoiceColumns: ColumnItem[];
  className?: string;
}

const SettingsBilling1 = ({
  usages = [
    {
      title: "User Licenses",
      usage: 9,
      total: 10,
    },
    {
      title: "API Credits",
      usage: 342,
      total: 5000,
      tag: "6.8% consumed",
      actionButtonText: "See details",
      actionButtonLink: "https://shadcnblocks.com",
      info: `Credits renew on ${new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    },
  ],
  billingDetails = [
    {
      label: "Contact Email",
      value: "billing@company.com",
    },
    {
      label: "Organization",
      value: "Demo Corporation",
    },
    {
      label: "Address",
      value: "789 Enterprise Blvd, Metro City, ST 54321",
    },
    {
      label: "Tax ID",
      value: "XX-1234567",
    },
  ],
  invoices = [
    {
      reference: "INV-2024-0043",
      totalInclTax: "$249.99",
      status: "Pending",
      date: new Date(Date.now()).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    },
    {
      reference: "INV-2024-0042",
      totalInclTax: "$249.99",
      status: "Paid",
      date: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "en-GB",
        { day: "2-digit", month: "short", year: "numeric" },
      ),
    },
  ],
  invoiceColumns = [
    {
      header: "Reference",
      accessorKey: "reference",
    },
    {
      header: "Total incl. tax",
      accessorKey: "totalInclTax",
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (value) => (
        <Badge
          variant="secondary"
          className={cn(
            value === "Paid"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700",
          )}
        >
          {value}
        </Badge>
      ),
    },
    {
      header: "Date",
      accessorKey: "date",
    },
  ],
  className,
}: SettingsBilling1Props) => {
  return (
    <section className="py-32">
      <div className={cn("container", className)}>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-4 border-b pb-6">
            <h4 className="text-xl font-semibold">Current Usage</h4>
            <div className="flex flex-col gap-4">
              {usages.map((usage, i) => (
                <UsageCard key={`usage-${i}-${usage.title}`} usage={usage} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b pb-6">
            <h4 className="text-xl font-semibold">Account Information</h4>
            <div className="grid gap-y-6 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                {billingDetails.map((detail, i) => (
                  <BillingDetailCard
                    key={`detail-${i}-${detail.label}`}
                    detail={detail}
                  />
                ))}

                <Button variant="outline" size="sm" className="w-fit">
                  Edit information
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="flex flex-col gap-0.5 text-sm font-semibold">
                  Payment Options
                </p>
                <Button variant="outline" size="sm" className="w-fit">
                  Manage payments
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xl font-semibold">Payment History</h4>

            <DataTable
              columns={invoiceColumns}
              data={invoices}
              actions={() => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                >
                  <Download />
                </Button>
              )}
            />

            <Button variant="destructive" size="sm" className="mt-2 w-fit">
              End subscription
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export { SettingsBilling1 };
