import { Skeleton } from "@/components/ui/skeleton"

export default function TelegramBotLoading() {
    return (
        <>
            <Skeleton className="h-8 w-48 mb-4 m-6" />
            <Skeleton className="h-4 w-64 mb-8 ml-6" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-6">
                <Skeleton className="h-[500px]" />
                <div className="space-y-6">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        </>
    )
}
