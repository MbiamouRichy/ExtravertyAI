import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjectLoadingShell } from "@/components/dashboard/project/project-loading-shell";

export default function BillingLoading() {
  return (
    <ProjectLoadingShell label="Chargement de la facturation…">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="space-y-3 border-b bg-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              <Skeleton className="h-3 w-48 max-w-full" />
              <Skeleton className="h-9 w-44 max-w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="space-y-3">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className="h-10 w-56 max-w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-48 max-w-full" />
            <div className="space-y-2 border-t pt-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-9 w-44 max-w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-52 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-52 max-w-full" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {Array.from({ length: 5 }, (_, index) => (
                  <TableHead key={index} className="px-4">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }, (_, row) => (
                <TableRow key={row}>
                  {Array.from({ length: 5 }, (_, column) => (
                    <TableCell key={column} className="px-4 py-4">
                      <Skeleton
                        className={
                          column === 3 ? "h-6 w-20 rounded-full" : "h-4 w-24"
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-44" />
          </div>
        </CardContent>
      </Card>
    </ProjectLoadingShell>
  );
}
