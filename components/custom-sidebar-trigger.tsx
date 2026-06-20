import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function CustomSidebarTrigger() {
	return (
		<Tooltip delayDuration={1000}>
			<TooltipTrigger asChild>
				<SidebarTrigger variant="ghost" />
			</TooltipTrigger>
			<TooltipContent className="px-2 py-1" side="right">
				Basculer la barre latérale {" "}
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>b</Kbd>
				</KbdGroup>
			</TooltipContent>
		</Tooltip>
	);
}
