import { useState, useCallback } from 'react'
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useModalFocus } from '@/hooks/useModalFocus'
import { FileDropZone } from './FileDropZone'
import { ColumnMapper } from './ColumnMapper'
import { ImportPreview } from './ImportPreview'
import { downloadPlayerTemplate } from '@/lib/generateTemplate'
import {
  parseFile,
  suggestMappings,
  transformData,
  useImportPlayers,
} from '@/hooks/useSpreadsheetImport'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import type { SpreadsheetData, PlayerFieldMapping, ParsedPlayer } from '@/lib/spreadsheetTypes'

interface SpreadsheetImportModalProps {
  leagueId: string
  isOpen: boolean
  onClose: () => void
  onImportComplete: (count: number) => void
}

type Step = 'upload' | 'configure' | 'map' | 'preview'

export function SpreadsheetImportModal({
  leagueId,
  isOpen,
  onClose,
  onImportComplete,
}: SpreadsheetImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null)
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true)
  const [mappings, setMappings] = useState<Record<string, PlayerFieldMapping>>({})
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([])

  const { addToast } = useToast()
  const { data: fieldSchemas } = useLeagueFieldSchemas(leagueId)
  const importPlayers = useImportPlayers({ leagueId })

  const handleFileSelect = useCallback(
    async (file: File) => {
      // Validate file type
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]
      const isValidType =
        validTypes.includes(file.type) ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')

      if (!isValidType) {
        addToast('Please upload a CSV or Excel file (.csv, .xlsx)', 'error')
        return
      }

      setIsLoading(true)
      try {
        const data = await parseFile(file)
        setSpreadsheetData(data)

        // Auto-suggest mappings based on headers (includes league field schemas)
        const suggestedMappings = suggestMappings(data.headers, fieldSchemas)
        setMappings(suggestedMappings)

        setStep('configure')
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'Failed to parse file', 'error')
      } finally {
        setIsLoading(false)
      }
    },
    [addToast, fieldSchemas]
  )

  const handleMappingChange = useCallback((column: string, mapping: PlayerFieldMapping) => {
    setMappings((prev) => ({ ...prev, [column]: mapping }))
  }, [])

  const handleToggleRow = useCallback((index: number) => {
    setParsedPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, isSelected: !p.isSelected } : p))
    )
  }, [])

  const proceedToPreview = useCallback(() => {
    if (!spreadsheetData) return

    const players = transformData(spreadsheetData, mappings, firstRowIsHeader, fieldSchemas)
    setParsedPlayers(players)
    setStep('preview')
  }, [spreadsheetData, mappings, firstRowIsHeader])

  const handleImport = useCallback(async () => {
    try {
      const result = await importPlayers.mutateAsync(parsedPlayers)
      addToast(
        `Imported ${result.playersCreated} players${
          result.playersSkipped > 0 ? `. ${result.playersSkipped} rows skipped.` : ''
        }`,
        'success'
      )
      onImportComplete(result.playersCreated)
      onClose()
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Import failed', 'error')
    }
  }, [importPlayers, parsedPlayers, addToast, onImportComplete, onClose])

  const resetAndClose = useCallback(() => {
    setStep('upload')
    setSpreadsheetData(null)
    setMappings({})
    setParsedPlayers([])
    setFirstRowIsHeader(true)
    onClose()
  }, [onClose])

  // Check if name is mapped
  const hasNameMapping = Object.values(mappings).some(
    (m) => m.type === 'standard' && m.field === 'name'
  )

  const validPlayerCount = parsedPlayers.filter((p) => p.isValid && p.isSelected).length

  const { overlayProps } = useModalFocus({ onClose: resetAndClose, enabled: isOpen })

  if (!isOpen) return null

  return (
    <div {...overlayProps} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-4xl flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-shrink-0">
          <CardTitle>Import Players from Spreadsheet</CardTitle>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => downloadPlayerTemplate(fieldSchemas)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Download the template, fill it out with your players, then upload it below.
                <br />
                You can add additional columns for custom fields.
              </div>

              <FileDropZone onFileSelect={handleFileSelect} isLoading={isLoading} />
            </div>
          )}

          {/* Step: Configure */}
          {step === 'configure' && spreadsheetData && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={firstRowIsHeader}
                    onChange={(e) => setFirstRowIsHeader(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <div>
                    <div className="font-medium">First row contains column headers</div>
                    <div className="text-sm text-muted-foreground">
                      If checked, the first row will be used as column names and won't be imported as a player
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <h3 className="mb-2 font-medium">Preview ({spreadsheetData.fileName})</h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {spreadsheetData.headers.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                            {header || `Column ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {spreadsheetData.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 whitespace-nowrap">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {spreadsheetData.rows.length > 5 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Showing 5 of {spreadsheetData.rows.length} rows
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step: Map Columns */}
          {step === 'map' && spreadsheetData && (
            <ColumnMapper
              columns={spreadsheetData.headers}
              mappings={mappings}
              onMappingChange={handleMappingChange}
              sampleData={spreadsheetData.rows}
              fieldSchemas={fieldSchemas}
            />
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <ImportPreview players={parsedPlayers} onToggleRow={handleToggleRow} />
          )}
        </CardContent>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between border-t border-border p-4 flex-shrink-0">
          <div>
            {step !== 'upload' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === 'configure') setStep('upload')
                  else if (step === 'map') setStep('configure')
                  else if (step === 'preview') setStep('map')
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>

            {step === 'configure' && (
              <Button onClick={() => setStep('map')}>
                Map Columns
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {step === 'map' && (
              <Button onClick={proceedToPreview} disabled={!hasNameMapping}>
                Preview Import
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {step === 'preview' && (
              <Button
                onClick={handleImport}
                disabled={validPlayerCount === 0}
                loading={importPlayers.isPending}
              >
                Import {validPlayerCount} Player{validPlayerCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
