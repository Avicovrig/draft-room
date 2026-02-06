import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from './Button'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ImageCropperProps {
  onCropComplete: (croppedBlob: Blob) => void
  onCancel: () => void
  aspectRatio?: number
  onFileTooLarge?: () => void
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export function ImageCropper({
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  onFileTooLarge,
}: ImageCropperProps) {
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<Crop>()
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > MAX_FILE_SIZE) {
        onFileTooLarge?.()
        e.target.value = ''
        return
      }
      const reader = new FileReader()
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || '')
      )
      reader.readAsDataURL(file)
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, aspectRatio))
  }

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current
    if (!image || !completedCrop) return null

    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    const pixelCrop = {
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    }

    // Set canvas size to desired output size (400x400 for profile pics)
    const outputSize = 400
    canvas.width = outputSize
    canvas.height = outputSize

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputSize,
      outputSize
    )

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.75
      )
    })
  }, [completedCrop])

  async function handleSave() {
    const blob = await getCroppedImg()
    if (blob) {
      onCropComplete(blob)
    }
  }

  return (
    <div className="space-y-4">
      {!imgSrc && (
        <div className="flex flex-col items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onSelectFile}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            Select Image
          </Button>
          <p className="text-sm text-muted-foreground">
            Choose an image to crop for your profile picture
          </p>
        </div>
      )}

      {imgSrc && (
        <>
          <div className="flex justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              circularCrop
              className="max-h-[400px]"
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imgSrc}
                onLoad={onImageLoad}
                className="max-h-[400px] w-auto"
              />
            </ReactCrop>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!completedCrop}
              className="flex-1"
            >
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
