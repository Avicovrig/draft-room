import { useState, useCallback, useRef } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  accept?: string
}

export function FileDropZone({
  onFileSelect,
  isLoading = false,
  accept = '.csv,.xlsx,.xls',
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onFileSelect(file)
        // Reset so the same file can be re-selected
        e.target.value = ''
      }
    },
    [onFileSelect]
  )

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-accent/50',
        isLoading && 'pointer-events-none opacity-50'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
        disabled={isLoading}
      />

      {isLoading ? (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Processing file...</p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center rounded-full bg-primary/10 p-4">
            {isDragging ? (
              <FileSpreadsheet className="h-8 w-8 text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-primary" />
            )}
          </div>
          <p className="mt-4 text-center text-sm font-medium">
            {isDragging ? 'Drop file here' : 'Drag and drop a file here'}
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">or click to browse</p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Supports CSV and Excel files (.csv, .xlsx)
          </p>
        </>
      )}
    </div>
  )
}
