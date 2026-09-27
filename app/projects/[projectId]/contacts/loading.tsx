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

export default function ContactsLoading() {
  return (
    <ProjectLoadingShell label="Chargement des contacts…" className="space-y-7">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="gap-0 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="size-5 shrink-0" />
            </div>
            <Skeleton className="h-9 w-20" />
            <Skeleton className="mt-2 h-3 w-48 max-w-full" />
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className="space-y-4 border-b p-4 sm:p-5">
          <Skeleton className="h-9 w-full sm:w-56" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {["w-16", "w-28", "w-32"].map((width) => (
                <Skeleton
                  key={width}
                  className={`h-10 rounded-full ${width}`}
                />
              ))}
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-10 w-full sm:max-w-sm" />
            <Skeleton className="size-10 shrink-0 sm:w-28" />
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {Array.from({ length: 5 }, (_, index) => (
                    <TableHead
                      key={index}
                      className={
                        index > 0 && index < 4 ? "hidden md:table-cell" : ""
                      }
                    >
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 shrink-0 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24 sm:w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-9 w-28 rounded-full" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-10 w-20 sm:w-32" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
            </div>
          </div>
        </CardContent>
      </Card>
    </ProjectLoadingShell>
  );
}
