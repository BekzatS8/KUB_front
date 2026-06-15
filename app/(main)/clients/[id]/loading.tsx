import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function ClientProfileLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button skeleton */}
      <Skeleton className="h-8 w-40 mb-4" />

      <div className="flex gap-6">
        {/* Left sidebar skeleton */}
        <div className="w-56 shrink-0">
          <Card className="p-4">
            <Skeleton className="w-24 h-24 rounded-full mx-auto" />
            <Skeleton className="h-5 w-32 mx-auto mt-3" />
            <Skeleton className="h-4 w-20 mx-auto mt-1" />
            <Skeleton className="h-3 w-28 mx-auto mt-2" />
            <Skeleton className="h-px w-full my-3" />
            <div className="space-y-1">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <Skeleton className="h-px w-full my-3" />
            <Skeleton className="h-8 w-full rounded-md" />
          </Card>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
