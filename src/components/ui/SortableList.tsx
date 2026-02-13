import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DraggableAttributes } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { CSS } from '@dnd-kit/utilities'

// Context to pass useSortable's attributes/listeners from SortableItem to DragHandle
interface SortableItemContextValue {
  attributes: DraggableAttributes
  listeners: SyntheticListenerMap | undefined
}

const SortableItemContext = createContext<SortableItemContextValue | null>(null)

// --- SortableList ---

interface SortableListProps {
  items: string[]
  onReorder: (activeId: string, overId: string) => void
  disabled?: boolean
  children: ReactNode
  className?: string
}

export function SortableList({
  items,
  onReorder,
  disabled,
  children,
  className,
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(String(active.id), String(over.id))
  }

  if (disabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// --- SortableItem ---

interface SortableItemProps {
  id: string
  disabled?: boolean
  children: ReactNode | ((props: { isDragging: boolean }) => ReactNode)
  className?: string
  as?: 'li' | 'div'
}

export function SortableItem({
  id,
  disabled,
  children,
  className,
  as: Element = 'li',
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <Element ref={setNodeRef} style={style} className={className}>
      <SortableItemContext.Provider value={{ attributes, listeners }}>
        {typeof children === 'function' ? children({ isDragging }) : children}
      </SortableItemContext.Provider>
    </Element>
  )
}

// --- DragHandle ---

interface DragHandleProps {
  className?: string
}

export function DragHandle({ className }: DragHandleProps) {
  const ctx = useContext(SortableItemContext)
  if (!ctx) return null

  return (
    <button
      type="button"
      className={cn(
        'cursor-grab touch-none p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing',
        className
      )}
      aria-label="Drag to reorder"
      {...ctx.attributes}
      {...ctx.listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
