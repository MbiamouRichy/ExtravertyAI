import { cn } from "@/lib/utils";
import type React from "react";
import { FullWidthDivider } from "@/components/ui/full-width-divider";
import { Mail, MapPin, Phone } from "lucide-react";
import { AutomatiserButton } from "./hero";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { FacebookIcon } from "../social-icon";

const APP_EMAIL = "extravertyai@gmail.com";
const APP_PHONE = "+24176205629";

export function Contact() {
	const socialLinks = [
		{
			icon: FacebookIcon,
			href: "https://www.facebook.com/profile.php?id=61576441577255",
			label: "Facebook",
		}
		// {
		//   icon: TiktokIcon,
		//   href: "#",
		//   label: "Tiktok",
		// },
	];

	return (
		<div className="relative md:mx-auto min-h-screen w-full max-w-7xl border-x overflow-hidden">
			<div className="flex grow flex-col justify-center px-2 py-18 md:pt-24 lg:pt-28 md:items-center">
				<h1 className="font-bold text-4xl md:text-5xl">Contactez-nous</h1>
				<p className="mb-5 text-sm md:text-base text-muted-foreground">
					Contactez-nous pour toutes questions ou besoins de renseignements.
				</p>
			</div>
			<FullWidthDivider />
			<div className="grid md:grid-cols-3">
				<Box
					description="Nous répondons immédiatement."
					icon={
						<Mail
						/>
					}
					title="Email"
				>
					<Link aria-readonly
						className={cn(
							buttonVariants({ variant: "link" }), "pointer-events-none opacity-50"
						)}
						href={`mailto:${APP_EMAIL}`}
					>
						{APP_EMAIL}
					</Link>
				</Box>
				<Box
					description="Nous sommes à Libreville au Gabon."
					icon={
						<MapPin
						/>
					}
					title="Office"
				>
					<span className="font-medium font-mono text-sm tracking-wide">
						Libreville - Gabon
					</span>
				</Box>
				<Box
					className="border-b-0 md:border-r-0"
					description="Nous sommes disponibles 24h/7."
					icon={
						<Phone
						/>
					}
					title="Phone"
				>
					<div className="flex flex-col md:flex-row gap-2 items-center">
						<AutomatiserButton text={APP_PHONE}
						/>

						{/* <a
							className="block font-medium font-mono text-sm tracking-wide hover:underline"
							href={`tel:${APP_PHONE_2}`}
						>
							{APP_PHONE_2}
						</a> */}
					</div>
				</Box>
			</div>
			<FullWidthDivider />
			<div className="z-1 flex h-full flex-col items-center justify-center gap-4 py-24">
				<h2 className="text-center font-medium text-2xl text-muted-foreground tracking-tight md:text-3xl">
					Suivez-<span className="text-foreground">nous</span>
				</h2>
				<div className="flex flex-wrap items-center gap-2">
					{socialLinks.map((link) => (
						<Link
							className="flex items-center gap-x-2 rounded-full border bg-card px-3 py-1.5 shadow hover:bg-accent"
							href={link.href}
							key={link.label}
							rel="noopener noreferrer"
							target="_blank"
						>
							<link.icon className="size-3.5 text-muted-foreground" />
							<span className="font-medium font-mono text-xs tracking-wide">
								{link.label}
							</span>
						</Link>
					))}
				</div>
			</div>
		</div>
	);
}

type ContactBox = React.ComponentProps<"div"> & {
	icon: React.ReactNode;
	title: string;
	description: string;
};

function Box({
	title,
	description,
	className,
	children,
	...props
}: ContactBox) {
	return (
		<div
			className={cn(
				"flex flex-col justify-between border-b md:border-r md:border-b-0",
				className
			)}
		>
			<div
				className={cn(
					"flex items-center gap-x-3 border-b bg-secondary/50 p-4 dark:bg-secondary/20",
					"[&_svg]:size-5 [&_svg]:stroke-width-1 [&_svg]:text-muted-foreground"
				)}
			>
				{props.icon}
				<h2 className="font-heading font-medium text-lg tracking-wider">
					{title}
				</h2>
			</div>
			<div className="flex items-center gap-x-2 p-4 py-12">{children}</div>
			<div className="border-t p-4">
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
		</div>
	);
}






