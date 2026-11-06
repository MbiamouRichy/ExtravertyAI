import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import prisma from "@/lib/prisma"; // Assure-toi que ce chemin correspond à ton instance Prisma

type Stat = {
	label: string;
	value: string;
	delta: number;
	invertDelta?: boolean; // Permet de dire que "moins c'est mieux" (ex: pour les erreurs ou interventions)
};

// Fonction utilitaire pour calculer le pourcentage de croissance
const calculateDelta = (current: number, previous: number): number => {
	if (previous === 0) return current > 0 ? 100 : 0;
	return Number((((current - previous) / previous) * 100).toFixed(1));
};

// Formateur pour les grands nombres (ex: 1200 -> 1 200)
const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num);

export async function DashboardStats({ projectId }: { projectId: string }) {
	// Définition des fenêtres temporelles : 7 derniers jours vs 7 jours précédents
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

	// Exécution de toutes les requêtes en parallèle (Performance 🚀)
	const [
		currentContacts, prevContacts,
		currentInbound, prevInbound,
		currentBotReplies, prevBotReplies,
		currentHumanHandoff, prevHumanHandoff,
	] = await Promise.all([
		// 1. Nouveaux Contacts
		prisma.contact.count({ where: { projectId, createdAt: { gte: sevenDaysAgo } } }),
		prisma.contact.count({ where: { projectId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

		// 2. Messages Reçus (Clients)
		prisma.message.count({ where: { projectId, senderType: "CLIENT", createdAt: { gte: sevenDaysAgo } } }),
		prisma.message.count({ where: { projectId, senderType: "CLIENT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

		// 3. Réponses Automatisées (Bot)
		prisma.message.count({ where: { projectId, senderType: "BOT", createdAt: { gte: sevenDaysAgo } } }),
		prisma.message.count({ where: { projectId, senderType: "BOT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

		// 4. Interventions Humaines (Contacts où l'IA a été désactivée par un agent)
		// Note: On regarde les messages envoyés par un AGENT sur la période.
		prisma.message.count({ where: { projectId, senderType: "AGENT", createdAt: { gte: sevenDaysAgo } } }),
		prisma.message.count({ where: { projectId, senderType: "AGENT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
	]);

	// Construction du tableau de statistiques
	const stats: Stat[] = [
		{
			label: "Nouveaux contacts",
			value: formatNumber(currentContacts),
			delta: calculateDelta(currentContacts, prevContacts),
		},
		{
			label: "Messages reçus",
			value: formatNumber(currentInbound),
			delta: calculateDelta(currentInbound, prevInbound),
		},
		{
			label: "Réponses du bot",
			value: formatNumber(currentBotReplies),
			delta: calculateDelta(currentBotReplies, prevBotReplies),
		},
		{
			label: "Interventions humaines",
			value: formatNumber(currentHumanHandoff),
			delta: calculateDelta(currentHumanHandoff, prevHumanHandoff),
			invertDelta: true, // Moins d'interventions humaines = meilleure autonomie de l'IA
		},
	];

	return (
		<dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border @3xl:grid-cols-4">
			{stats.map((s) => (
				<div className="flex min-w-0 flex-col gap-1 bg-card p-3 sm:p-4" key={s.label}>
					<dt className="text-xs text-muted-foreground">{s.label}</dt>
					<dd className="mt-auto text-2xl font-semibold tabular-nums tracking-tight">
						{s.value}
					</dd>
					<dd className="flex flex-wrap items-center gap-x-1 text-xs">
						<Delta value={s.delta}>
							<DeltaIcon />
							<DeltaValue />
						</Delta>
						<span className="text-muted-foreground">vs sem. dernière</span>
					</dd>
				</div>
			))}
		</dl>
	);
}
