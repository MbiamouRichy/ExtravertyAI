"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
    ArrowUpRight,
    MoreHorizontal,
} from "lucide-react";
import Link from "next/link";

function ProjectsRecents({ recentProjects }: { recentProjects: { id: string; name: string; numero: string; status: string; date: string }[] }) {
    return (
        <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg">Projets récents</CardTitle>
                    <CardDescription>
                        Vos dernières instances connectées.
                    </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/projects">
                        Voir tout <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>

            </CardHeader>
            <CardContent>
                <div className="border border-neutral-100 rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-100">
                            <tr>
                                <th className="px-4 py-3">Nom du projet</th>
                                <th className="px-4 py-3">Numéro</th>
                                <th className="px-4 py-3">Statut</th>
                                <th className="px-4 py-3">Créé le</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {recentProjects.map((project) => (
                                <tr key={project.id} className="hover:bg-neutral-50/50 transition-colors">
                                    <td className="px-4 py-4 font-medium text-neutral-900">{project.name}</td>
                                    <td className="px-4 py-4 text-neutral-600 font-mono text-xs">{project.numero}</td>
                                    <td className="px-4 py-4">
                                        {project.status === "active" ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                En ligne
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                En attente
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-neutral-500">{project.date}</td>
                                    <td className="px-4 py-4 text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-neutral-900">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {recentProjects.length === 0 && (
                        <div className="p-8 text-center text-neutral-500">
                            Aucun projet récent trouvé.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default ProjectsRecents