import type { ReactNode } from "react";
import { BarChart3Icon, BriefcaseIcon, UsersIcon, SettingsIcon, CreditCardIcon, HelpCircleIcon, BookOpenIcon, FolderEditIcon, LayoutDashboard, MessageSquareIcon, UserCogIcon, ContactIcon } from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
	show?: boolean;
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

// Transformation en fonction pour accepter projectId
export const getNavGroups = (projectId: string): SidebarNavGroup[] => [
	{
		label: "Product",
		items: [
			{
				title: "Dashboard",
				path: `/projects/${projectId}`, // Chemin dynamique
				icon: <LayoutDashboard />,
			},
			{
				title: "Analytics",
				path: `/projects/${projectId}/analytics`,
				icon: <BarChart3Icon />,
			},
			{
				title: "Chat",
				path: `/projects/${projectId}/chat`, // Chemin dynamique
				icon: <MessageSquareIcon />,
			},
			{
				title: "Contacts",
				path: `/projects/${projectId}/contacts`,
				icon: <ContactIcon />,
			},
			{
				title: "Projets",
				path: "/projects", // Reste statique si c'est la liste générale
				icon: <BriefcaseIcon />,
			},
			{
				title: "User",
				path: `/projects/user`,
				icon: <UserCogIcon />,
				show: false,
			},
			{
				title: "New project",
				path: "/projects/new",
				icon: <FolderEditIcon />,
				show: false,
			},
			{
				title: "Plan",
				path: `/projects/${projectId}/billing`,
				icon: <CreditCardIcon />,
				show: false,
			},
		],
	},
	{
		label: "Workspace",
		items: [
			{
				title: "Team",
				path: `/projects/${projectId}/team`,
				icon: <UsersIcon />,
			},
			// {
			// 	title: "Integrations",
			// 	path: `/projects/${projectId}/integrations`,
			// 	icon: <PlugIcon />,
			// },
			// {
			// 	title: "API Keys",
			// 	path: `/projects/${projectId}/api-keys`,
			// 	icon: <KeyRoundIcon />,
			// },
		],
	},
	{
		label: "Administration",
		items: [
			{
				title: "Settings",
				path: `/projects/${projectId}/settings`,
				icon: <SettingsIcon />,
			},
			{
				title: "Billing",
				path: `/projects/${projectId}/billing`,
				icon: <CreditCardIcon />,
			},
		],
	},
];

// Si les liens du footer dépendent aussi du projet, transformez-les en fonction.
// Sinon, laissez-les en tableau constant.
export const footerNavLinks: SidebarNavItem[] = [
	{
		title: "Help Center",
		path: "#/help",
		icon: <HelpCircleIcon />,
	},
	{
		title: "Documentation",
		path: "#/documentation",
		icon: <BookOpenIcon />,
	},
];

export const navLinks = (projectId: string): SidebarNavItem[] => [
	...getNavGroups(projectId).flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];