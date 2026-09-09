// app/invite/loading.tsx
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function InviteLoading() {
    return (
        <Card className="w-full sm:max-w-md shadow-lg border">
            {/* Header Skeleton */}
            <CardHeader className="space-y-3 text-center">
                <div className="mx-auto mb-2 flex items-center justify-center">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
                <div className="flex justify-center">
                    <Skeleton className="h-6 w-44" />
                </div>
                <div className="flex flex-col items-center gap-1.5 pt-1">
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            </CardHeader>

            {/* Form Fields Skeleton */}
            <CardContent className="space-y-4">
                {/* Field 1: Email (ReadOnly) */}
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>

                {/* Field 2: Name */}
                <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>

                {/* Field 3: Password */}
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
            </CardContent>

            {/* Footer Skeleton */}
            <CardFooter className="flex flex-col space-y-4">
                <Skeleton className="h-10 w-full rounded-md" />

                <div className="flex flex-col items-center gap-1.5 w-full pt-1">
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="h-3 w-4/5" />
                </div>
            </CardFooter>
        </Card>
    );
}