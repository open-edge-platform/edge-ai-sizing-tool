// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useRef, useState, useEffect } from 'react'
import { FileVideo, Upload, X, FolderArchive } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useCreateWorkload, useUpdateWorkload } from '@/hooks/useWorkload'
import { Workload } from '@/payload-types'
import { useAccelerator } from '@/hooks/useAccelerator'
import { toast } from 'sonner'
import { useUploadMedia } from '@/hooks/useMedia'
import useGetDevices from '@/hooks/useDevices'
import { ErrorResponse } from '@/types/error'
import { metadata, TaskOptions, UsecaseOptions } from '@/config/workloads'
import { Input } from './ui/input'
import { useCustomModel, useUploadCustomModel } from '@/hooks/useModel'
import { useSystemInfo } from '@/hooks/useSystemInformation'
import { WorkloadResponse } from '@/types/workload-types'
import { formatFileSize } from '@/lib/utils'

type TaskType = keyof typeof metadata.tasks
type UsecaseType = keyof TaskOptions['usecase']
type ModelType = keyof UsecaseOptions['model']
type NumberStreamChange = number | undefined
type CustomModel =
  | {
      name: string
      size: number | null
      type: string
    }
  | undefined

function getNumStreams(metadata: Workload['metadata']): number | undefined {
  return isMetadataObject(metadata) && typeof metadata.numStreams === 'number'
    ? metadata.numStreams
    : undefined
}

function isCustomModel(
  metadata: Workload['metadata'],
): CustomModel | undefined {
  if (
    isMetadataObject(metadata) &&
    typeof metadata.customModel === 'object' &&
    metadata.customModel !== null &&
    'name' in metadata.customModel &&
    'size' in metadata.customModel &&
    'type' in metadata.customModel
  ) {
    return metadata.customModel as {
      name: string
      size: number | null
      type: string
    }
  }
  return undefined
}

function isMetadataObject(
  metadata: Workload['metadata'],
): metadata is { [k: string]: unknown } {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
  )
}

export default function WorkloadForm({ workload }: { workload?: Workload }) {
  const router = useRouter()
  const isEdit = !!workload
  const { data: camDevices } = useGetDevices()
  const { data: customModelData } = useCustomModel()
  const [addWorkload, setAddWorkload] = useState<Partial<Workload>>({
    task: '' as TaskType,
    usecase: '',
    model: '',
    metadata: { customModel: undefined, numStreams: undefined },
    devices: [],
    source: {
      name: '',
      size: null,
      type: '',
    },
  })
  const [availableDevices, setAvailableDevices] = useState<
    { id: string; name: string }[]
  >([])
  const [availableUsecases, setAvailableUsecases] = useState<string[]>([])
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [modelSelectionType, setModelSelectionType] = useState<
    'predefined' | 'huggingface' | 'upload' | 'directory'
  >('predefined')
  const [isDisable, setIsDisable] = useState<boolean>(true)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const selectedInputFileRef = useRef<File | null>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const selectedModelFileRef = useRef<File | null>(null)

  const { data: devicesData } = useAccelerator()
  const acceleratorDevices = devicesData?.devices
  const { data } = useSystemInfo()

  const createWorkload = useCreateWorkload()
  const uploadmedia = useUploadMedia()
  const uploadCustomModel = useUploadCustomModel()
  const updateWorkload = useUpdateWorkload(isEdit ? workload?.id : 0)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    if (data?.os?.distro?.includes('Windows')) {
      delete metadata.tasks['computer vision'].usecase[
        'object detection (DLStreamer)'
      ]
      delete metadata.tasks['computer vision'].usecase[
        'instance segmentation (DLStreamer)'
      ]
    }
    if (workload) {
      setAvailableUsecases(
        Object.keys(metadata.tasks[workload.task as TaskType].usecase),
      )
      if (workload.model === 'custom_model') {
        setModelSelectionType('upload')
      } else if (
        workload.model &&
        workload.usecase &&
        customModelData &&
        Array.isArray(customModelData[workload.usecase.replace(/ /g, '-')]) &&
        customModelData[workload.usecase.replace(/ /g, '-')].includes(
          workload.model,
        )
      ) {
        setModelSelectionType('directory')
      } else if (
        workload.model &&
        !Object.keys(
          metadata.tasks[workload.task as TaskType].usecase[
            workload.usecase as UsecaseType
          ].model,
        ).includes(workload.model)
      ) {
        setModelSelectionType('huggingface')
      } else {
        setModelSelectionType('predefined')
      }

      if (
        workload.task &&
        workload.usecase &&
        metadata.tasks[workload.task] &&
        metadata.tasks[workload.task].usecase[workload.usecase] &&
        Object.keys(
          metadata.tasks[workload.task].usecase[workload.usecase].model || {},
        ).length > 0
      ) {
        setAvailableModels(
          Object.keys(
            metadata.tasks[workload.task]?.usecase[workload.usecase]?.model,
          ),
        )
      }

      setAvailableDevices(() => {
        const modelConfig =
          metadata.tasks[workload.task]?.usecase[workload.usecase]?.model[
            workload.model
          ]

        const incompatibleDevices = modelConfig?.devicesFiltered || []

        if (Array.isArray(acceleratorDevices)) {
          return acceleratorDevices.filter(
            (device) =>
              Array.isArray(incompatibleDevices) &&
              !incompatibleDevices.includes(device.id) &&
              (!device.id.startsWith('GPU') ||
                !incompatibleDevices.includes('GPU')),
          )
        } else {
          console.error('Devices are not an array:', acceleratorDevices)
        }
        return []
      })

      setAddWorkload({
        ...workload,
        metadata: {
          ...(isMetadataObject(workload.metadata) ? workload.metadata : {}),
          customModel: isCustomModel(workload.metadata) ?? undefined,
          numStreams: getNumStreams(workload.metadata) ?? 1,
        },
      })
    }
  }, [acceleratorDevices, workload, customModelData, data?.os?.distro])

  useEffect(() => {
    const { task, usecase, model, metadata, devices, source } = addWorkload
    setIsDisable(true)
    if (task && usecase) {
      if (usecase.includes('DLStreamer')) {
        if (model === 'custom_model') {
          setIsDisable(
            !model ||
              !devices?.length ||
              !source ||
              !source.name ||
              source.name === '' ||
              source.name === 'no-cam' ||
              !source.type ||
              !metadata ||
              isCustomModel(metadata) === undefined,
          )
        } else {
          setIsDisable(
            !model ||
              !devices?.length ||
              !source ||
              !source.name ||
              source.name === '' ||
              source.name === 'no-cam' ||
              !source.type,
          )
        }
      } else if (model === 'custom_model') {
        setIsDisable(
          !devices?.length ||
            !metadata ||
            isCustomModel(metadata) === undefined,
        )
      } else {
        setIsDisable(!model || devices?.length === 0)
      }
    }
  }, [addWorkload, isDisable])

  const handleAddWorkload = async () => {
    setIsLoading(true)
    try {
      if (
        addWorkload.usecase?.includes('DLStreamer') &&
        addWorkload.source?.type === 'file'
      ) {
        const file = selectedInputFileRef.current
        if (file) {
          const response = await uploadmedia.mutateAsync(file)
          if (!response) {
            toast.error('Failed to upload file')
            return
          }
          if (response.error) {
            toast.error(`Failed to upload file: ${response.error}`)
            return
          }
          addWorkload.source.name = response.file
        } else {
          toast.error('Please select a file')
          return
        }
      }

      if (
        addWorkload.model === 'custom_model' &&
        isCustomModel(addWorkload.metadata)?.type === 'file'
      ) {
        const file = selectedModelFileRef.current
        if (file) {
          const response = await uploadCustomModel.mutateAsync(file)
          if (!response) {
            toast.error('Failed to upload custom model')
            return
          }
          if (response.error) {
            toast.error(`Failed to upload custom model: ${response.error}`)
            return
          }
          isCustomModel(addWorkload.metadata)!.name = response.file
        } else {
          toast.error('Please select a custom model file')
          return
        }
      }

      const transformedDevice = addWorkload.devices?.map((item) => ({
        device: item.device,
      }))

      const isDLStreamer = addWorkload.usecase?.includes('DLStreamer')
      const response: WorkloadResponse = await createWorkload.mutateAsync({
        ...addWorkload,
        devices: transformedDevice,
        ...(isDLStreamer && {
          numStreams: getNumStreams(addWorkload.metadata),
        }),
      })

      toast.success(response.message)

      // Redirect to the new workload's page using the ID from the `doc` property
      router.push(`/workload/${response.doc.id}`)
    } catch (error: unknown) {
      const typedError = error as ErrorResponse
      console.error('Failed to create workload:', typedError.message)
      toast.error(`Failed to add workload: ${typedError.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskChange = (selectedTask: TaskType) => {
    setAddWorkload({
      ...addWorkload,
      task: selectedTask,
      usecase: '',
      model: addWorkload.model === 'custom_model' ? 'custom_model' : '',
      devices: [],
    })

    const usecases = Object.keys(
      metadata.tasks[selectedTask].usecase,
    ) as UsecaseType[]
    setAvailableUsecases(usecases)
  }

  const handleUseCaseChange = (selectedUseCase: UsecaseType) => {
    if (addWorkload.task) {
      setAddWorkload({
        ...addWorkload,
        usecase: selectedUseCase,
        model: addWorkload.model === 'custom_model' ? 'custom_model' : '',
        devices: [],
        source: selectedUseCase.includes('DLStreamer')
          ? {
              type: 'predefined-videos',
              name: 'people-detection.mp4',
              size: null,
            }
          : undefined,
        metadata: {
          ...(isMetadataObject(addWorkload.metadata)
            ? addWorkload.metadata
            : {}),
          numStreams: selectedUseCase.includes('DLStreamer') ? 1 : undefined,
        },
      })

      const models = Object.keys(
        metadata.tasks[addWorkload.task]?.usecase[selectedUseCase]?.model,
      ) as ModelType[]

      setAvailableModels(models)
    }
  }

  const handleUseCaseNumberStreamChange = (
    selectedNumberStream: NumberStreamChange,
  ) => {
    setAddWorkload((prev) => ({
      ...prev,
      metadata: {
        ...(isMetadataObject(prev.metadata) ? prev.metadata : {}),
        numStreams: selectedNumberStream,
      },
    }))
  }

  const handleModelChange = (selectedModel: ModelType) => {
    if (addWorkload.task && addWorkload.usecase) {
      setAddWorkload({
        ...addWorkload,
        model: selectedModel,
        devices: [],
      })

      const modelConfig =
        metadata.tasks[addWorkload.task]?.usecase[addWorkload.usecase]?.model[
          selectedModel
        ]
      const incompatibleDevices = modelConfig?.devicesFiltered || []

      if (Array.isArray(acceleratorDevices)) {
        setAvailableDevices(
          acceleratorDevices.filter(
            (device) =>
              !incompatibleDevices.includes(device.id) &&
              (!device.id.startsWith('GPU') ||
                !incompatibleDevices.includes('GPU')),
          ),
        )
      } else {
        console.error('Devices are not an array:', acceleratorDevices)
      }
    }

    if (selectedModel === 'custom_model') {
      setAddWorkload({
        ...addWorkload,
        model: 'custom_model',
      })
      setAvailableDevices(acceleratorDevices || [])
    }
  }

  const handleDeviceChange = (selectedDevice: string, isChecked: boolean) => {
    setAddWorkload((prevState) => {
      const allowMultipleDevices =
        metadata.tasks[prevState.task as TaskType]?.usecase[
          prevState.usecase as UsecaseType
        ]?.model[prevState.model as ModelType]?.allowMultipleDevices
      const updatedDevices = isChecked
        ? allowMultipleDevices
          ? [...(prevState.devices || []), { device: selectedDevice }]
          : [{ device: selectedDevice }]
        : prevState.devices?.filter((d) => d.device !== selectedDevice)
      return { ...prevState, devices: updatedDevices }
    })
  }

  const validateAndSetFile = (selectedFile: File) => {
    try {
      if (!selectedFile.type.startsWith('video/')) {
        toast.error('Please upload an video file (MP4, MOV, etc.)')
        return
      }

      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('Please upload an audio file smaller than 50MB')
        return
      }
      selectedInputFileRef.current = selectedFile
      setAddWorkload({
        ...addWorkload,
        source: {
          type: 'file',
          name: selectedFile.name,
          size: selectedFile.size,
        },
      })
    } catch (error) {
      console.error('Error validating file:', error)
      toast.error('Failed to validate file.')
    }
  }

  const validateAndSetCustomModel = (selectedFile: File) => {
    try {
      if (
        selectedFile.type !== 'application/zip' &&
        !selectedFile.name.endsWith('.zip')
      ) {
        toast.error('Please upload a ZIP file.')
        return
      }

      selectedModelFileRef.current = selectedFile
      setAddWorkload({
        ...addWorkload,
        metadata: {
          ...(isMetadataObject(addWorkload.metadata)
            ? addWorkload.metadata
            : {}),
          customModel: {
            type: 'file',
            name: selectedFile.name,
            size: selectedFile.size,
          },
        },
      })
    } catch (error) {
      console.error('Error validating file:', error)
      toast.error('Failed to validate file.')
    }
  }

  const clearFile = () => {
    try {
      setAddWorkload((prev) => {
        return { ...prev, source: { type: 'file', name: null, size: null } }
      })
      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error clearing file input:', error)
      toast.error('Failed to clear file input.')
    }
  }

  const clearZipFile = () => {
    try {
      setAddWorkload((prev) => {
        return {
          ...prev,
          metadata: {
            ...(isMetadataObject(prev.metadata) ? prev.metadata : {}),
            customModel: undefined,
          },
        }
      })
      if (modelInputRef.current) {
        modelInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error clearing file input:', error)
      toast.error('Failed to clear file input.')
    }
  }

  function handleInputChanged(value: string) {
    if (value === 'predefined-videos') {
      setAddWorkload((prev) => ({
        ...prev,
        source: {
          type: 'predefined-videos',
          name: 'people-detection.mp4',
          size: null,
        },
      }))
    } else if (value === 'file') {
      setAddWorkload((prev) => ({
        ...prev,
        source: {
          type: 'file',
          name: null,
          size: null,
        },
      }))
    } else {
      setAddWorkload((prev) => {
        return { ...prev, source: { type: value } }
      })
    }
  }

  const handleCamChanged = (selectedDeviceId: string) => {
    setAddWorkload((prev) => ({
      ...prev,
      source: {
        ...prev.source,
        name: selectedDeviceId,
      },
    }))
  }

  const handleSaveWorkload = async () => {
    if (!workload || !workload.id) return
    setIsLoading(true)
    try {
      await updateWorkload.mutateAsync({ ...addWorkload, status: 'prepare' })
      toast.success('Workload updated successfully!')

      // Redirect to the workload page after successful save
      router.push(`/workload/${workload.id}`)
    } catch (error: unknown) {
      // Parse the error response to extract validation errors
      const typedError = error as ErrorResponse
      if (typedError.response?.errors) {
        const validationErrors = typedError.response.errors
          .map(
            (err) =>
              `${err.data.errors[0].label}: ${err.data.errors[0].message}`,
          )
          .join(', ')
        toast.error(`Failed to update workload: ${validationErrors}`)
      } else {
        toast.error(
          `Failed to update workload: ${typedError.message || 'Unknown error'}`,
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleVideoChanged = (selectedVideo: string) => {
    setAddWorkload((prev) => ({
      ...prev,
      source: {
        ...prev.source,
        name: selectedVideo,
      },
    }))
  }

  return (
    <div className="h-full w-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-6 lg:min-w-[750px] xl:min-w-[1000px]">
        {/* Scrollable Content Area */}
        <div className="hide-scrollbar flex-1 overflow-auto pb-16">
          <div className="w-full py-6">
            <Card className="mx-auto max-w-3xl">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">
                      {isEdit ? 'Edit' : 'Add'} Workload
                    </CardTitle>
                    <CardDescription>
                      {isEdit ? 'Edit' : 'Add new'} workload to evaluate system
                      performance.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden">
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="task">Task</Label>
                      <Select
                        onValueChange={handleTaskChange}
                        value={addWorkload.task}
                      >
                        <SelectTrigger id="task">
                          <SelectValue placeholder="Select task" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(metadata.tasks).map((task) => (
                            <SelectItem key={task} value={task}>
                              {task
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, function (char) {
                                  return char.toUpperCase()
                                })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="usecase">Usecase</Label>
                      <Select
                        onValueChange={handleUseCaseChange}
                        value={addWorkload.usecase}
                      >
                        <SelectTrigger id="usecase">
                          <SelectValue placeholder="Select usecase" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsecases.map((useCase) => (
                            <SelectItem key={useCase} value={useCase}>
                              {useCase
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, function (char) {
                                  return char.toUpperCase()
                                })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {addWorkload.usecase?.includes('(DLStreamer)') && (
                      <div className="grid gap-2">
                        <Label htmlFor="input">Input</Label>
                        <Select
                          onValueChange={handleInputChanged}
                          value={addWorkload.source?.type ?? 'cam'}
                        >
                          <SelectTrigger id="input">
                            <SelectValue placeholder="Select input" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={'cam'}>Camera</SelectItem>
                            <SelectItem value={'file'}>File</SelectItem>
                            <SelectItem value={'predefined-videos'}>
                              Predefined Videos
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {addWorkload.source?.type === 'file' && (
                          <div
                            className={`rounded-lg border-2 border-dashed p-6 text-center ${addWorkload.source ? 'border-primary' : 'border-muted-foreground/25'} transition-colors`}
                            role="button"
                            tabIndex={0}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const files = e.dataTransfer.files
                              if (files.length > 0) {
                                validateAndSetFile(files[0])
                              }
                            }}
                            onClick={() => videoInputRef.current?.click()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                videoInputRef.current?.click()
                              }
                            }}
                          >
                            <input
                              type="file"
                              ref={videoInputRef}
                              onChange={(e) => {
                                if (
                                  e.target.files &&
                                  e.target.files.length > 0
                                ) {
                                  validateAndSetFile(e.target.files[0])
                                }
                              }}
                              accept="video/*"
                              className="hidden"
                            />

                            {!addWorkload.source || !addWorkload.source.name ? (
                              <div className="flex flex-col items-center justify-center py-4">
                                <Upload className="text-muted-foreground mb-2 h-10 w-10" />
                                <p className="text-muted-foreground mb-1 text-sm">
                                  Drag and drop your video file here
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  Supports MP4, MOV, and more (max 50MB)
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center">
                                  <FileVideo className="text-primary mr-2 h-8 w-8" />
                                  <div className="text-left">
                                    <p className="max-w-[200px] truncate text-sm font-medium">
                                      {addWorkload.source?.name ||
                                        'No source name available'}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {addWorkload.source?.size !== null &&
                                      addWorkload.source?.size !== undefined
                                        ? formatFileSize(
                                            addWorkload.source.size,
                                          )
                                        : 'No size available'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    clearFile()
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {addWorkload.source?.type === 'cam' && (
                          <>
                            <Label htmlFor="inputDevice">Input Device</Label>
                            <Select
                              onValueChange={handleCamChanged}
                              value={addWorkload.source?.name ?? 'no-cam'}
                            >
                              <SelectTrigger id="input">
                                <SelectValue placeholder="Select input" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(camDevices?.devices ?? {}).map(
                                  ([label, id]) => (
                                    <SelectItem
                                      key={(id as number).toString()}
                                      value={(id as number).toString()}
                                    >
                                      {label as string}
                                    </SelectItem>
                                  ),
                                )}
                                {Object.entries(camDevices?.devices ?? {})
                                  .length === 0 && (
                                  <SelectItem value="no-cam" disabled>
                                    No camera devices found
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {addWorkload.source?.type === 'predefined-videos' && (
                          <>
                            <Label htmlFor="videos">Videos</Label>
                            <Select
                              onValueChange={handleVideoChanged}
                              value={
                                addWorkload.source?.name ??
                                'people-detection.mp4'
                              }
                            >
                              <SelectTrigger id="videoSelectionInput">
                                <SelectValue placeholder="Select input" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="people-detection.mp4">
                                  People Detection (12fps)
                                </SelectItem>
                                <SelectItem value="person-bicycle-car-detection.mp4">
                                  Person Bicycle Car Detection (12fps)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {
                          <div className="grid gap-2">
                            <Label htmlFor="numStreams">
                              Number of streams
                            </Label>
                            <input
                              id="numStreams"
                              type="number"
                              min={1}
                              step={1}
                              value={getNumStreams(addWorkload.metadata) ?? ''}
                              onChange={(e) => {
                                const rawValue = e.target.value
                                if (rawValue === '') {
                                  handleUseCaseNumberStreamChange(undefined)
                                } else {
                                  const num = Number(rawValue)
                                  handleUseCaseNumberStreamChange(
                                    num < 1 ? 1 : num,
                                  )
                                }
                              }}
                              onBlur={() => {
                                const numStreams = getNumStreams(
                                  addWorkload.metadata,
                                )
                                if (!numStreams || numStreams < 1) {
                                  handleUseCaseNumberStreamChange(1)
                                }
                              }}
                              className="w-24 rounded border px-2 py-1"
                            />
                          </div>
                        }
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="modelSource">Model Source</Label>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="predefined"
                            name="model-type"
                            value="predefined"
                            checked={modelSelectionType === 'predefined'}
                            onChange={(e) => {
                              setModelSelectionType(
                                e.target.value as
                                  | 'predefined'
                                  | 'huggingface'
                                  | 'upload'
                                  | 'directory',
                              )
                              setAddWorkload((prev) => {
                                return {
                                  ...prev,
                                  model: '',
                                  metadata: {
                                    ...(isMetadataObject(prev.metadata)
                                      ? prev.metadata
                                      : {}),
                                    customModel: undefined,
                                  },
                                }
                              })
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="predefined" className="font-normal">
                            Predefined Models
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="huggingface"
                            name="model-type"
                            value="huggingface"
                            checked={modelSelectionType === 'huggingface'}
                            disabled={addWorkload.usecase?.includes(
                              'DLStreamer',
                            )}
                            onChange={(e) => {
                              setModelSelectionType(
                                e.target.value as
                                  | 'predefined'
                                  | 'huggingface'
                                  | 'upload'
                                  | 'directory',
                              )
                              setAddWorkload((prev) => {
                                if (prev.task && prev.usecase) {
                                  const models = Object.keys(
                                    metadata.tasks[prev.task]?.usecase[
                                      prev.usecase
                                    ]?.model || {},
                                  )
                                  setAvailableModels(models)
                                }
                                return {
                                  ...prev,
                                  model: '',
                                  metadata: {
                                    ...(isMetadataObject(prev.metadata)
                                      ? prev.metadata
                                      : {}),
                                    customModel: undefined,
                                  },
                                }
                              })
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="huggingface" className="font-normal">
                            Hugging Face Model
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="upload"
                            name="model-type"
                            value="upload"
                            checked={modelSelectionType === 'upload'}
                            onChange={(e) => {
                              setModelSelectionType(
                                e.target.value as
                                  | 'predefined'
                                  | 'huggingface'
                                  | 'upload'
                                  | 'directory',
                              )
                              setAddWorkload((prev) => {
                                if (prev.task && prev.usecase) {
                                  const models = Object.keys(
                                    metadata.tasks[prev.task]?.usecase[
                                      prev.usecase
                                    ]?.model || {},
                                  )
                                  setAvailableModels(models)
                                }
                                return {
                                  ...prev,
                                  model: 'custom_model',
                                  metadata: {
                                    ...(isMetadataObject(prev.metadata)
                                      ? prev.metadata
                                      : {}),
                                    customModel: {
                                      name: '',
                                      size: null,
                                      type: '',
                                    },
                                  },
                                }
                              })
                              handleModelChange('custom_model')
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="upload" className="font-normal">
                            Upload Model File
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="directory"
                            name="model-type"
                            value="directory"
                            checked={modelSelectionType === 'directory'}
                            onChange={(e) => {
                              setModelSelectionType(
                                e.target.value as
                                  | 'predefined'
                                  | 'huggingface'
                                  | 'upload'
                                  | 'directory',
                              )
                              setAddWorkload((prev) => {
                                if (prev.task && prev.usecase) {
                                  const models = Object.keys(
                                    metadata.tasks[prev.task]?.usecase[
                                      prev.usecase
                                    ]?.model || {},
                                  )
                                  setAvailableModels(models)
                                }
                                return {
                                  ...prev,
                                  model: '',
                                  metadata: {
                                    ...(isMetadataObject(prev.metadata)
                                      ? prev.metadata
                                      : {}),
                                    customModel: undefined,
                                  },
                                }
                              })
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="directory" className="font-normal">
                            Custom Model Directory
                          </Label>
                        </div>
                      </div>

                      {modelSelectionType === 'predefined' && (
                        <>
                          <div className="grid gap-2 pt-2">
                            <Label htmlFor="model">Model</Label>
                            <Select
                              onValueChange={handleModelChange}
                              value={addWorkload.model}
                            >
                              <SelectTrigger id="model">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels.map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {modelSelectionType === 'huggingface' && (
                        <div className="grid gap-2 pt-2">
                          <Label htmlFor="hf-model-id">
                            Hugging Face Model ID
                          </Label>
                          <Input
                            id="hf-model-id"
                            placeholder="e.g., microsoft/DialoGPT-medium"
                            value={addWorkload.model || ''}
                            onChange={(e) => handleModelChange(e.target.value)}
                            className="font-normal"
                            disabled={addWorkload.usecase?.includes(
                              'DLStreamer',
                            )}
                          />
                          <p className="text-muted-foreground text-xs">
                            Enter the model ID from Hugging Face Hub (format:
                            organization/model-name)
                          </p>
                        </div>
                      )}

                      {modelSelectionType === 'upload' && (
                        <div className="grid gap-2 pt-2">
                          <Label htmlFor="upload-model">Model ZIP File</Label>
                          <div
                            className={`rounded-lg border-2 border-dashed p-6 text-center ${
                              isCustomModel(addWorkload.metadata)?.name
                                ? 'border-primary'
                                : 'border-muted-foreground/25'
                            } transition-colors`}
                            role="button"
                            tabIndex={0}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const files = e.dataTransfer.files
                              if (files.length > 0) {
                                validateAndSetCustomModel(files[0])
                              }
                            }}
                            onClick={() => modelInputRef.current?.click()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                modelInputRef.current?.click()
                              }
                            }}
                          >
                            <input
                              type="file"
                              ref={modelInputRef}
                              onChange={(e) => {
                                if (
                                  e.target.files &&
                                  e.target.files.length > 0
                                ) {
                                  validateAndSetCustomModel(e.target.files[0])
                                }
                              }}
                              accept=".zip,application/zip"
                              className="hidden"
                            />
                            {!isCustomModel(addWorkload.metadata)?.name ? (
                              <div className="flex flex-col items-center justify-center py-4">
                                <Upload className="text-muted-foreground mb-2 h-10 w-10" />
                                <p className="text-muted-foreground mb-1 text-sm">
                                  Drag and drop your model ZIP file here
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  Supports ZIP file containing OpenVINO IR
                                  (.xml, .bin) model files only.
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center">
                                  <FolderArchive className="text-primary mr-2 h-8 w-8" />
                                  <div className="text-left">
                                    <p className="max-w-[200px] truncate text-sm font-medium">
                                      {isCustomModel(addWorkload.metadata)
                                        ? isCustomModel(addWorkload.metadata)
                                            ?.name
                                        : ''}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {isCustomModel(addWorkload.metadata)
                                        ? formatFileSize(
                                            isCustomModel(addWorkload.metadata)
                                              ?.size || 0,
                                          )
                                        : 'No size available'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    clearZipFile()
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {modelSelectionType === 'directory' && (
                        <>
                          <div className="grid gap-2 pt-2">
                            <Label htmlFor="model-dir">Custom Model</Label>
                            <Select
                              onValueChange={handleModelChange}
                              value={addWorkload.model}
                            >
                              <SelectTrigger id="model-dir">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {customModelData &&
                                  addWorkload.usecase &&
                                  Array.isArray(
                                    customModelData[
                                      addWorkload.usecase.replace(/ /g, '-')
                                    ],
                                  ) &&
                                  customModelData[
                                    addWorkload.usecase.replace(/ /g, '-')
                                  ].map((model: string) => (
                                    <SelectItem key={model} value={model}>
                                      {model}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="device">Device</Label>
                      <div id="device">
                        {availableDevices.map((device) => (
                          <div key={device.id} className="flex items-center">
                            <input
                              type="checkbox"
                              id={device.id}
                              value={device.id}
                              checked={addWorkload.devices?.some(
                                (d) => d.device === device.id,
                              )}
                              onChange={(e) =>
                                handleDeviceChange(device.id, e.target.checked)
                              }
                              className="mr-2 cursor-pointer"
                            />
                            <label
                              className="mr-2 cursor-pointer"
                              htmlFor={device.id}
                            >
                              {device.name} - {device.id}
                            </label>
                          </div>
                        ))}
                      </div>
                      {addWorkload.devices?.length !== 0 && (
                        <div className="mt-2 rounded-md bg-gray-50 p-4 dark:bg-gray-700">
                          <Label className="mb-4">Priority order:</Label>
                          <ol className="counter-reset-[list] space-y-1">
                            {addWorkload.devices?.map((item, index) => {
                              const deviceDetails = availableDevices.find(
                                (device) => device.id === item.device,
                              )
                              const deviceName =
                                deviceDetails?.name || item.device
                              return (
                                <li
                                  key={index}
                                  className="counter-increment-[list] flex items-center pb-4 pl-4"
                                >
                                  <div className="bg-primary border-primary flex h-7 w-7 items-center justify-center rounded-full border">
                                    <span className="text-sm font-medium text-white before:content-[counter(list)]">
                                      {index + 1}
                                    </span>
                                  </div>
                                  <div className="ml-2">
                                    <Label className="text-gray-600 dark:text-gray-300">
                                      {deviceName}
                                    </Label>
                                  </div>
                                </li>
                              )
                            })}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      isEdit ? handleSaveWorkload() : handleAddWorkload()
                    }
                    disabled={isDisable || isLoading}
                  >
                    {isLoading
                      ? 'Loading...'
                      : isEdit
                        ? 'Save Workload'
                        : 'Add Workload'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
