import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
	return (
		<div
			className={cn(
				"grid grid-cols-1 md:grid-cols-2 gap-4 m-4 md:m-6 lg:grid-cols-4",
				"*:min-h-48 *:w-full *:bg-muted *:dark:bg-muted/50"
			)}
		>
			<div className="rounded-lg" />
			<div className="rounded-lg" />
			<div className="rounded-lg" />
			<div className="rounded-lg" />
			<div className="col-span-2 rounded-lg min-h-114! lg:col-span-2" />
			<div className="col-span-2 rounded-lg min-h-92! lg:col-span-2" />
			<div className="col-span-2 rounded-lg min-h-92! lg:col-span-2" />
			<div className="col-span-1 rounded-lg min-h-92! lg:col-span-1" />
			<div className="col-span-1 rounded-lg min-h-92! lg:col-span-1" />
			<div className="rounded-lg md:col-span-2 min-h-92! lg:col-span-3" />
			<div className="rounded-lg col-span-1 min-h-92! lg:col-span-1" />
		</div>
	);
}
