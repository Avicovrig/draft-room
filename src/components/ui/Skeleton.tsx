import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <Skeleton className="mb-4 h-6 w-1/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="mb-2 h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  )
}

export function ManageLeagueSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 sm:p-8">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-1 h-8 w-64" />
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="mb-6 flex gap-2 border-b border-border pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  )
}

export function LeagueCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-4 w-2/3" />
      <Skeleton className="mb-4 h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}

export function LeagueListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 sm:gap-4">
      <Skeleton className="h-2 w-2 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-1 h-5 w-1/3" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="hidden gap-4 sm:flex">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
      <Skeleton className="h-7 w-7 rounded-md" />
      <Skeleton className="h-4 w-4" />
    </div>
  )
}
