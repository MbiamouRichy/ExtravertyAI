import { NotFoundPage } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import { Folder, HomeIcon } from 'lucide-react'
import Link from 'next/link'

export default function NotFoundDashboard() {
    return (
        <NotFoundPage>
            <div className="flex gap-2">
                <Button asChild>
                    <Link title="page d'accueil" href="/projects">
                        <HomeIcon data-icon="inline-start" />
                        Dashboard
                    </Link>
                </Button>

                <Button asChild variant="outline">
                    <Link title="page de contact" href="/projects">
                        <Folder data-icon="inline-start" />{" "}
                        Vos projets
                    </Link>
                </Button>
            </div>
        </NotFoundPage>
    )
}
