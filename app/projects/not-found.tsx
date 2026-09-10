import { NotFoundPage } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import { BriefcaseBusinessIcon } from 'lucide-react'
import Link from 'next/link'


export default function NotFoundDashboard() {

    return (
        <NotFoundPage
            personalButton={
                <Button asChild>
                    <Link title="Vos Projects" href="/projects">
                        <BriefcaseBusinessIcon data-icon="inline-start" />
                        Dashboard
                    </Link>
                </Button>
            }
        />
    )
}

