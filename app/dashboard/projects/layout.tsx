export default function Projects ({children}: {children: React.ReactNode}) {
    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">Projects</h1>
            <p>Welcome to the projects page.</p>
            {children}
        </div>
    );
}