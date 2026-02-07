import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
          {item.href ? (
            <Link to={item.href} className="transition-colors hover:text-foreground truncate">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground truncate">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
