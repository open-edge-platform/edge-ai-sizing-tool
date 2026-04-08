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
import {
  FileVideo,
  Upload,
  X,
  FolderArchive,
  LayoutGrid,
  ChevronDown,
} from 'lucide-react'
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
import { useBatchProfile } from '@/hooks/useBatchProfile'
import { ErrorResponse } from '@/types/error'
import { metadata, TaskOptions, UsecaseOptions } from '@/config/workloads'
import { Input } from './ui/input'
import { useCustomModel, useUploadCustomModel } from '@/hooks/useModel'
import { useSystemInfo } from '@/hooks/useSystemInformation'
import { formatFileSize, normalizeProcessName } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useProfilingContext,
  ProfilingData,
} from '@/contexts/profiling-context'

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

function getRepoPlatform(metadata: Workload['metadata']): string {
  return isMetadataObject(metadata) && typeof metadata.repoPlatform === 'string'
    ? metadata.repoPlatform
    : 'huggingface'
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
    return metadata.customModel as CustomModel
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
  const { setProfilingData, addProfilingSession, addToHistory } =
    useProfilingContext()
  const isEdit = !!workload

  const { data: camDevices } = useGetDevices()
  const { data: customModelData } = useCustomModel()
  const { data: devicesData } = useAccelerator()
  const { data: systemInfo } = useSystemInfo()
  const acceleratorDevices = devicesData?.devices

  const createWorkload = useCreateWorkload()
  const uploadmedia = useUploadMedia()
  const uploadCustomModel = useUploadCustomModel()
  const updateWorkload = useUpdateWorkload(isEdit ? workload?.id : 0)
  const batchProfile = useBatchProfile(6240)

  const [addWorkload, setAddWorkload] = useState<Partial<Workload>>({
    task: '' as TaskType,
    usecase: '',
    model: '',
    metadata: {
      customModel: undefined,
      numStreams: undefined,
      pid: undefined,
      processName: undefined,
      selectionType: 'pid',
      appPath: undefined,
      duration: 30,
      repoPlatform: 'huggingface',
    },
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
    'predefined' | 'modelRepo' | 'upload' | 'directory'
  >('predefined')
  const [repoPlatform, setRepoPlatform] = useState<
    'huggingface' | 'modelscope'
  >('huggingface')
  const [isDisable, setIsDisable] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [progress, setProgress] = useState(0)
  const [timeRemaining, setTimeReamining] = useState(0)

  const videoInputRef = useRef<HTMLInputElement>(null)
  const selectedInputFileRef = useRef<File | null>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const selectedModelFileRef = useRef<File | null>(null)

  // Reset Progress when not loading
  useEffect(() => {
    if (!isLoading) {
      setProgress(0)
      setTimeReamining(0)
    }
  }, [isLoading])

  // Initialize from when editing existing workload
  useEffect(() => {
    if (systemInfo?.os?.distro?.includes('Windows')) {
      delete metadata.tasks['computer vision'].usecase[
        'object detection (DLStreamer)'
      ]
      delete metadata.tasks['computer vision'].usecase[
        'instance segmentation (DLStreamer)'
      ]
    }
    if (!workload) return

    if (workload) {
      if (workload.task === 'custom application monitoring') {
        setAddWorkload({
          task: 'custom application monitoring',
          usecase: 'custom application monitoring',
          model: '',
          metadata: {
            ...(isMetadataObject(workload.metadata) ? workload.metadata : {}),
            selectionType:
              isMetadataObject(workload.metadata) &&
              typeof workload.metadata.selectionType === 'string'
                ? (workload.metadata.selectionType as 'pid' | 'appname')
                : 'pid',
            pid:
              isMetadataObject(workload.metadata) &&
              typeof workload.metadata.pid === 'number'
                ? workload.metadata.pid
                : undefined,
            processName:
              isMetadataObject(workload.metadata) &&
              typeof workload.metadata.processName === 'string'
                ? workload.metadata.processName
                : undefined,
            appPath:
              isMetadataObject(workload.metadata) &&
              typeof workload.metadata.appPath === 'string'
                ? workload.metadata.appPath
                : undefined,
            duration:
              isMetadataObject(workload.metadata) &&
              typeof workload.metadata.duration === 'number'
                ? workload.metadata.duration
                : 30,
          },
          devices: [],
          source: {
            name: '',
            size: null,
            type: '',
          },
        })
        setAvailableUsecases(
          Object.keys(metadata.tasks[workload.task as TaskType].usecase),
        )
      } else {
        // Handle other workload types
        const usecaseObj = metadata.tasks[workload.task as TaskType]?.usecase
        setAvailableUsecases(usecaseObj ? Object.keys(usecaseObj) : [])

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
          workload.task &&
          workload.usecase &&
          !Object.keys(
            metadata.tasks[workload.task as TaskType].usecase[
              workload.usecase as UsecaseType
            ].model,
          ).includes(workload.model)
        ) {
          setModelSelectionType('modelRepo')
          setRepoPlatform(
            (getRepoPlatform(workload.metadata) ?? 'huggingface') as
              | 'huggingface'
              | 'modelscope',
          )
        } else {
          const usecaseObj = metadata.tasks[workload.task as TaskType]?.usecase
          setAvailableUsecases(usecaseObj ? Object.keys(usecaseObj) : [])
          if (workload.model === 'custom_model') {
            setModelSelectionType('upload')
          } else if (
            workload.model &&
            workload.usecase &&
            customModelData &&
            Array.isArray(
              customModelData[workload.usecase.replace(/ /g, '-')],
            ) &&
            customModelData[workload.usecase.replace(/ /g, '-')].includes(
              workload.model,
            )
          ) {
            setModelSelectionType('directory')
          } else if (
            workload?.model &&
            workload.task &&
            workload.usecase &&
            !Object.keys(
              workload?.task &&
                metadata.tasks[workload.task as TaskType]?.usecase[
                  workload?.usecase as UsecaseType
                ]?.model,
            ).includes(workload.model)
          ) {
            setModelSelectionType('modelRepo')
            setRepoPlatform(
              (getRepoPlatform(workload.metadata) ?? 'huggingface') as
                | 'huggingface'
                | 'modelscope',
            )
          } else {
            setModelSelectionType('predefined')
          }

          // Set available models
          if (
            workload.task &&
            workload.usecase &&
            metadata.tasks[workload.task] &&
            metadata.tasks[workload.task].usecase[workload.usecase] &&
            Object.keys(
              metadata.tasks[workload.task].usecase[workload.usecase].model ||
                {},
            ).length > 0
          ) {
            setAvailableModels(
              Object.keys(
                metadata.tasks[workload.task].usecase[workload.usecase].model,
              ),
            )
          }

          // Set available devices
          const modelConfig =
            workload.model != null
              ? metadata.tasks[workload.task].usecase[workload.usecase].model[
                  workload.model
                ]
              : undefined
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

        setAddWorkload({
          ...workload,
          metadata: {
            ...(isMetadataObject(workload.metadata) ? workload.metadata : {}),
            customModel: isCustomModel(workload.metadata) ?? undefined,
            repoPlatform: getRepoPlatform(workload.metadata) ?? 'huggingface',
            numStreams: getNumStreams(workload.metadata) ?? 1,
          },
        })
      }
    }
  }, [acceleratorDevices, workload, customModelData, systemInfo?.os?.distro])

  useEffect(() => {
    const { task, usecase, model, metadata, devices, source } = addWorkload
    setIsDisable(true)

    if (task === 'custom application monitoring') {
      const hasValidSelection =
        isMetadataObject(metadata) &&
        ((metadata.selectionType === 'pid' &&
          typeof metadata.pid === 'number' &&
          metadata.pid > 0) ||
          (metadata.selectionType === 'appname' &&
            typeof metadata.appPath === 'string' &&
            metadata.appPath.trim().length > 0))
      const hasDuration =
        isMetadataObject(metadata) &&
        typeof metadata.duration === 'number' &&
        metadata.duration > 0 &&
        metadata.duration <= 3600

      setIsDisable(!hasValidSelection || !hasDuration)
      return
    }

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
  }, [addWorkload])

  const handleAddWorkload = async () => {
    setIsLoading(true)

    try {
      // Handle custom application monitoring separately
      if (addWorkload.task === 'custom application monitoring') {
        const metadata = addWorkload.metadata
        if (isMetadataObject(metadata)) {
          const durationSeconds =
            typeof metadata.duration === 'number' ? metadata.duration : 30

          // Input Validation
          if (
            metadata.selectionType === 'pid' &&
            typeof metadata.pid !== 'number'
          ) {
            toast.error('Please provide a valid PID')
            return
          }
          if (
            metadata.selectionType === 'appname' &&
            (typeof metadata.appPath !== 'string' ||
              metadata.appPath.trim().length === 0)
          ) {
            toast.error('Please provide an application path')
            return
          }

          // Start Progress Tracking
          setTimeReamining(durationSeconds)
          const startTime = Date.now()
          const progressInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000
            const remaining = Math.max(0, durationSeconds - elapsed)
            const progressPercent = Math.min(
              100,
              (elapsed / durationSeconds) * 100,
            )
            setProgress(progressPercent)
            setTimeReamining(Math.ceil(remaining))

            if (remaining <= 0) {
              clearInterval(progressInterval)
            }
          }, 100)

          toast.info('Starting profiling...')

          try {
            // Start profiling and wait for results
            const profilingResults = await batchProfile.mutateAsync({
              selection_type: metadata.selectionType as 'pid' | 'appname',
              ...(metadata.selectionType === 'pid' && {
                pid: metadata.pid as number,
                appPath: metadata.processName
                  ? normalizeProcessName(metadata.processName as string)
                  : `pid_${metadata.pid}`,
              }),
              ...(metadata.selectionType === 'appname' && {
                app_path: (metadata.appPath as string).trim(),
              }),
              duration: durationSeconds,
            })

            clearInterval(progressInterval)
            setProgress(100)
            setTimeReamining(0)

            toast.success('Profiling completed successfully')

            let actualPID: number | undefined

            if (profilingResults?.application?.root_pid) {
              actualPID = profilingResults.application.root_pid
            } else if (profilingResults?.application?.pid) {
              actualPID = profilingResults.application.pid
            } else if (
              profilingResults?.application?.pids &&
              Array.isArray(profilingResults.application.pids)
            ) {
              actualPID = profilingResults.application.pids[0]
            } else if (metadata.selectionType === 'pid' && metadata.pid) {
              actualPID = metadata.pid as number
            }

            if (!actualPID || actualPID < 0) {
              throw new Error(
                'Failed to retrieve valid PID from profiling results',
              )
            }

            // Prepare profiling data
            const profilingData: ProfilingData = {
              pid: actualPID,
              sessionId:
                profilingResults?.session_id ||
                profilingResults?.application?.app_id ||
                `session_${Date.now()}`,
              processName:
                profilingResults?.application?.process_name ||
                (typeof metadata.processName === 'string'
                  ? metadata.processName
                  : undefined),
              appName: profilingResults?.application?.name,
              appPath:
                (typeof metadata.appPath === 'string'
                  ? metadata.appPath
                  : undefined) || profilingResults?.application?.name,
              duration: durationSeconds,
              timestamp: new Date().toISOString(),
              command:
                profilingResults?.application?.command ||
                (typeof metadata.processName === 'string'
                  ? metadata.processName
                  : undefined) ||
                `pid_${metadata.pid}`,
              results: profilingResults,
              selectionType: metadata.selectionType as 'pid' | 'appname', // Type assertion here
              allPids: profilingResults?.application?.pids || [actualPID],
            }

            // Store in context
            setProfilingData(profilingData)
            addProfilingSession(profilingData)

            // Add to history
            addToHistory({
              pid: actualPID,
              sessionId: profilingData.sessionId,
              processName: profilingData.processName,
              appPath: profilingData.appPath,
              timestamp: profilingData.timestamp,
              selectionType: profilingData.selectionType,
              allPids: profilingData.allPids,
            })

            // Redirect to profiling results page with PID
            router.push(`/profiling/${actualPID}`)
            return
          } catch (error) {
            clearInterval(progressInterval)
            console.error('Failed to complete profiling:', error)
            toast.error(
              `Profiling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
          }
          setIsLoading(false)
          return
        }
      }

      // Regular workload creation for other tasks
      // Handle DLStreamer file upload
      if (
        addWorkload.usecase?.includes('DLStreamer') &&
        addWorkload.source?.type === 'file'
      ) {
        const file = selectedInputFileRef.current
        if (file) {
          const response = await uploadmedia.mutateAsync(file)
          if (!response || response.error) {
            toast.error('Failed to upload file')
            setIsLoading(false)
            return
          }
          addWorkload.source.name = response.file
        } else {
          toast.error('Please select a file')
          setIsLoading(false)
          return
        }
      }

      // Upload Custom Model if needed
      if (
        addWorkload.model === 'custom_model' &&
        isCustomModel(addWorkload.metadata)?.type === 'file'
      ) {
        const file = selectedModelFileRef.current
        if (file) {
          const response = await uploadCustomModel.mutateAsync(file)
          if (!response) {
            toast.error('Failed to upload custom model')
            setIsLoading(false)
            return
          }
          if (response.error) {
            toast.error(`Failed to upload custom model: ${response.error}`)
            setIsLoading(false)
            return
          }
          isCustomModel(addWorkload.metadata)!.name = response.file
        } else {
          toast.error('Please select a custom model file')
          setIsLoading(false)
          return
        }
      }

      const transformedDevice = addWorkload.devices?.map((item) => ({
        device: item.device,
      }))

      const isDLStreamer = addWorkload.usecase?.includes('DLStreamer')
      const res = await createWorkload.mutateAsync({
        ...addWorkload,
        devices: transformedDevice,
        ...(isDLStreamer && {
          numStreams: getNumStreams(addWorkload.metadata),
        }),
        ...(getRepoPlatform(addWorkload.metadata) === 'modelscope' && {
          repoPlatform: getRepoPlatform(addWorkload.metadata),
        }),
      })

      toast.success(res.message)
      router.push(`/workload/${res.doc.id}`)
    } catch (error: unknown) {
      const typedError = error as ErrorResponse
      console.error('Failed to create workload:', typedError.message)
      toast.error(`Failed to add workload: ${typedError.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskChange = (selectedTask: TaskType) => {
    if (selectedTask === 'custom application monitoring') {
      setAddWorkload({
        task: selectedTask,
        usecase: 'custom application monitoring',
        model: '',
        metadata: {
          pid: undefined,
          processName: undefined,
          selectionType: 'pid',
          appPath: undefined,
          duration: 30,
        },
        devices: [],
        source: {
          name: '',
          size: null,
          type: '',
        },
      })
      setAvailableUsecases([])
      setAvailableModels([])
      setAvailableDevices([])
    } else {
      setAddWorkload({
        ...addWorkload,
        task: selectedTask,
        usecase: '',
        model: '',
        devices: [],
      })
      const usecases = Object.keys(metadata.tasks[selectedTask].usecase || {})
      setAvailableUsecases(usecases)
      setAvailableModels([])
      setAvailableDevices([])
    }
  }

  const handleUseCaseChange = (selectedUseCase: UsecaseType) => {
    if (addWorkload.task === 'custom application monitoring') {
      return
    }
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
        metadata?.tasks[addWorkload.task]?.usecase[selectedUseCase]?.model,
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

  const handleRepoPlatformChange = (platform: 'huggingface' | 'modelscope') => {
    setRepoPlatform(platform)
    setAddWorkload((prev) => ({
      ...prev,
      model: '',
      metadata: { repoPlatform: platform },
    }))
  }

  const handleModelIdInput = (modelId: string) => {
    setAddWorkload((prev) => ({
      ...prev,
      model: modelId,
      devices: [],
    }))
    setAvailableDevices(acceleratorDevices || [])
  }

  return (
    <div className="h-full w-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-6 lg:min-w-187.5 xl:min-w-250">
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
                    {/* Task Selection */}
                    <div className="grid gap-2">
                      <Label htmlFor="task">Task</Label>
                      <Select
                        onValueChange={handleTaskChange}
                        value={addWorkload.task}
                      >
                        <SelectTrigger
                          id="task"
                          className={
                            isLoading ? 'cursor-not-allowed opacity-50' : ''
                          }
                        >
                          <SelectValue placeholder="Select task" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(metadata.tasks)
                            .filter((task) => {
                              // Hide custom application monitoring on Windows
                              if (task === 'custom application monitoring') {
                                return !systemInfo?.os?.distro?.includes(
                                  'Windows',
                                )
                              }
                              return true
                            })
                            .map((task) => (
                              <SelectItem key={task} value={task}>
                                {task
                                  .replace(/_/g, ' ')
                                  .replace(/\b\w/g, (char) =>
                                    char.toUpperCase(),
                                  )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Application Monitoring Form */}
                    {addWorkload.task === 'custom application monitoring' ? (
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="pid">Process Selection</Label>
                          <div className="w-full space-y-4">
                            <div className="border-input bg-background focus-within:border-primary focus-within:ring-primary flex items-stretch overflow-hidden rounded-xl border shadow-sm transition-all focus-within:ring-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    disabled={isLoading}
                                    className="border-input bg-muted hover:bg-muted/80 flex items-center gap-2 border-r px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <LayoutGrid className="text-muted-foreground h-4 w-4" />
                                    <span>
                                      {addWorkload.metadata &&
                                      isMetadataObject(addWorkload.metadata) &&
                                      addWorkload.metadata.selectionType ===
                                        'appname'
                                        ? 'Application Path'
                                        : 'PID'}
                                    </span>
                                    <ChevronDown className="text-muted-foreground h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-48"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setAddWorkload((prev) => ({
                                        ...prev,
                                        metadata: {
                                          ...(isMetadataObject(prev.metadata)
                                            ? prev.metadata
                                            : {}),
                                          selectionType: 'pid',
                                          pid: undefined,
                                          appPath: undefined,
                                        },
                                      }))
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    PID
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setAddWorkload((prev) => ({
                                        ...prev,
                                        metadata: {
                                          ...(isMetadataObject(prev.metadata)
                                            ? prev.metadata
                                            : {}),
                                          selectionType: 'appname',
                                          pid: undefined,
                                          appPath: undefined,
                                        },
                                      }))
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    Application Path
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <div className="flex-1">
                                {addWorkload.metadata &&
                                isMetadataObject(addWorkload.metadata) &&
                                addWorkload.metadata.selectionType === 'pid' ? (
                                  <input
                                    type="number"
                                    placeholder="Enter PID (e.g., 10054)"
                                    value={
                                      typeof addWorkload.metadata.pid ===
                                      'number'
                                        ? addWorkload.metadata.pid.toString()
                                        : ''
                                    }
                                    onChange={(e) => {
                                      const pid = e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined
                                      setAddWorkload((prev) => ({
                                        ...prev,
                                        metadata: {
                                          ...(isMetadataObject(prev.metadata)
                                            ? prev.metadata
                                            : {}),
                                          pid,
                                        },
                                      }))
                                    }}
                                    disabled={isLoading}
                                    className="placeholder:text-muted-foreground h-full w-full bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    placeholder="Enter application name"
                                    value={
                                      addWorkload.metadata &&
                                      isMetadataObject(addWorkload.metadata) &&
                                      typeof addWorkload.metadata.appPath ===
                                        'string'
                                        ? addWorkload.metadata.appPath
                                        : ''
                                    }
                                    onChange={(e) => {
                                      setAddWorkload((prev) => ({
                                        ...prev,
                                        metadata: {
                                          ...(isMetadataObject(prev.metadata)
                                            ? prev.metadata
                                            : {}),
                                          appPath: e.target.value,
                                        },
                                      }))
                                    }}
                                    disabled={isLoading}
                                    className="placeholder:text-muted-foreground h-full w-full bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="duration">Duration (seconds)</Label>
                          <input
                            id="duration"
                            type="number"
                            min="1"
                            max="3600"
                            placeholder="Enter duration (1-3600 seconds)"
                            value={
                              addWorkload.metadata &&
                              isMetadataObject(addWorkload.metadata) &&
                              typeof addWorkload.metadata.duration === 'number'
                                ? addWorkload.metadata.duration.toString()
                                : ''
                            }
                            onChange={(e) => {
                              const duration = e.target.value
                                ? parseInt(e.target.value)
                                : undefined
                              setAddWorkload((prev) => ({
                                ...prev,
                                metadata: {
                                  ...(isMetadataObject(prev.metadata)
                                    ? prev.metadata
                                    : {}),
                                  duration,
                                },
                              }))
                            }}
                            disabled={isLoading}
                            className={`rounded border px-3 py-2 ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                          />
                          <p className="text-muted-foreground text-xs">
                            Profiling duration in seconds (1-3600)
                          </p>
                        </div>

                        {/* Progress Bar - Only show when loading */}
                        {isLoading && (
                          <div className="space-y-2 rounded-lg border bg-blue-50 p-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-blue-900">
                                {timeRemaining <= 0
                                  ? 'Preparing profiling dashboard...'
                                  : 'Profiling in progress...'}
                              </span>
                              {timeRemaining > 0 && (
                                <span className="font-bold text-blue-600">
                                  {timeRemaining}s remaining
                                </span>
                              )}
                            </div>
                            <Progress value={progress} className="h-2" />
                            <p className="text-center text-xs text-blue-700">
                              {timeRemaining <= 0
                                ? 'Finalizing results and setting up dashboard...'
                                : 'Please wait while we collect performance metrics'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Regular Workload Form - Usecase, Model, Device, etc. */}
                        <div className="grid gap-2">
                          <Label htmlFor="usecase">Usecase</Label>
                          <Select
                            onValueChange={handleUseCaseChange}
                            value={addWorkload.usecase ?? undefined}
                          >
                            <SelectTrigger id="usecase">
                              <SelectValue placeholder="Select usecase" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableUsecases.map((useCase) => (
                                <SelectItem key={useCase} value={useCase}>
                                  {useCase
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, (char) =>
                                      char.toUpperCase(),
                                    )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* DLStreamer specific inputs */}
                        {addWorkload.usecase?.includes('DLStreamer') && (
                          <>
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
                                  <SelectItem value="cam">Camera</SelectItem>
                                  <SelectItem value="file">File</SelectItem>
                                  <SelectItem value="predefined-videos">
                                    Predefined Videos
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* File upload */}
                            {addWorkload.source?.type === 'file' && (
                              <div
                                className={`rounded-lg border-2 border-dashed p-6 text-center ${
                                  addWorkload.source.name
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

                                {!addWorkload.source.name ? (
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
                                        <p className="max-w-50 truncate text-sm font-medium">
                                          {addWorkload.source.name}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                          {addWorkload.source.size !== null &&
                                          addWorkload.source.size !== undefined
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

                            {/* Camera selection */}
                            {addWorkload.source?.type === 'cam' && (
                              <>
                                <Label htmlFor="inputDevice">
                                  Input Device
                                </Label>
                                <Select
                                  onValueChange={handleCamChanged}
                                  value={addWorkload.source?.name ?? 'no-cam'}
                                >
                                  <SelectTrigger id="input">
                                    <SelectValue placeholder="Select input" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(
                                      camDevices?.devices ?? {},
                                    ).map(([label, id]) => (
                                      <SelectItem
                                        key={(id as number).toString()}
                                        value={(id as number).toString()}
                                      >
                                        {label as string}
                                      </SelectItem>
                                    ))}
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

                            {/* Predefined videos */}
                            {addWorkload.source?.type ===
                              'predefined-videos' && (
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

                            {/* Number of streams */}
                            <div className="grid gap-2">
                              <Label htmlFor="numStreams">
                                Number of streams
                              </Label>
                              <input
                                id="numStreams"
                                type="number"
                                min={1}
                                step={1}
                                value={
                                  getNumStreams(addWorkload.metadata) ?? ''
                                }
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
                          </>
                        )}

                        {/* Model Source Selection */}
                        <div className="grid gap-2">
                          <Label htmlFor="modelSource">Model Source</Label>
                          <div className="flex flex-wrap gap-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="predefined"
                                name="model-type"
                                value="predefined"
                                checked={modelSelectionType === 'predefined'}
                                onChange={(e) => {
                                  setModelSelectionType(
                                    e.target.value as typeof modelSelectionType,
                                  )
                                  setAddWorkload((prev) => ({
                                    ...prev,
                                    model: '',
                                    metadata: {
                                      ...(isMetadataObject(prev.metadata)
                                        ? prev.metadata
                                        : {}),
                                      customModel: undefined,
                                    },
                                  }))
                                }}
                                className="h-4 w-4"
                              />
                              <Label
                                htmlFor="predefined"
                                className="font-normal"
                              >
                                Predefined Models
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="modelRepo"
                                name="model-type"
                                value="modelRepo"
                                checked={modelSelectionType === 'modelRepo'}
                                disabled={addWorkload.usecase?.includes(
                                  'DLStreamer',
                                )}
                                onChange={(e) => {
                                  setModelSelectionType(
                                    e.target.value as typeof modelSelectionType,
                                  )
                                  setAddWorkload((prev) => ({
                                    ...prev,
                                    model: '',
                                    metadata: {
                                      ...(isMetadataObject(prev.metadata)
                                        ? prev.metadata
                                        : {}),
                                      customModel: undefined,
                                    },
                                  }))
                                }}
                                className="h-4 w-4"
                              />
                              <Label
                                htmlFor="modelRepo"
                                className="font-normal"
                              >
                                Model Repository
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
                                    e.target.value as typeof modelSelectionType,
                                  )
                                  setAddWorkload((prev) => ({
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
                                  }))
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
                                    e.target.value as typeof modelSelectionType,
                                  )
                                  setAddWorkload((prev) => ({
                                    ...prev,
                                    model: '',
                                    metadata: {
                                      ...(isMetadataObject(prev.metadata)
                                        ? prev.metadata
                                        : {}),
                                      customModel: undefined,
                                    },
                                  }))
                                }}
                                className="h-4 w-4"
                              />
                              <Label
                                htmlFor="directory"
                                className="font-normal"
                              >
                                Custom Model Directory
                              </Label>
                            </div>
                          </div>

                          {/* Predefined Models */}
                          {modelSelectionType === 'predefined' && (
                            <div className="grid gap-2 pt-2">
                              <Label htmlFor="model">Model</Label>
                              <Select
                                onValueChange={handleModelChange}
                                value={addWorkload.model ?? undefined}
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
                              <p className="text-muted-foreground text-xs">
                                Model download will use the HF_ENDPOINT
                                configured in .env file. To change it, update
                                the HF_ENDPOINT in your .env file and restart
                                the application.
                              </p>
                            </div>
                          )}

                          {/* Model Repository */}
                          {modelSelectionType === 'modelRepo' && (
                            <div className="grid gap-2 pt-2">
                              <Label htmlFor="model-source">
                                Repository Platform
                              </Label>
                              <div className="mb-4 flex gap-4">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    id="huggingface"
                                    name="model-source"
                                    value="huggingface"
                                    checked={repoPlatform === 'huggingface'}
                                    onChange={(e) =>
                                      handleRepoPlatformChange(
                                        e.target.value as
                                          | 'huggingface'
                                          | 'modelscope',
                                      )
                                    }
                                    className="h-4 w-4"
                                  />
                                  <Label
                                    htmlFor="huggingface"
                                    className="font-normal"
                                  >
                                    Hugging Face
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    id="modelscope"
                                    name="model-source"
                                    value="modelscope"
                                    checked={repoPlatform === 'modelscope'}
                                    onChange={(e) =>
                                      handleRepoPlatformChange(
                                        e.target.value as
                                          | 'huggingface'
                                          | 'modelscope',
                                      )
                                    }
                                    className="h-4 w-4"
                                  />
                                  <Label
                                    htmlFor="modelscope"
                                    className="font-normal"
                                  >
                                    ModelScope
                                  </Label>
                                </div>
                              </div>

                              <Label htmlFor="model-id">Model ID</Label>
                              <Input
                                id="model-id"
                                placeholder={
                                  repoPlatform === 'huggingface'
                                    ? 'e.g., microsoft/DialoGPT-medium'
                                    : 'e.g., damo/nlp_structbert_backbone_base_std'
                                }
                                value={addWorkload.model || ''}
                                onChange={(e) =>
                                  handleModelIdInput(e.target.value)
                                }
                                className="font-normal"
                                disabled={addWorkload.usecase?.includes(
                                  'DLStreamer',
                                )}
                              />
                              <p className="text-muted-foreground text-xs">
                                {repoPlatform === 'huggingface'
                                  ? 'Enter the model ID from Hugging Face Hub (format: organization/model-name)'
                                  : 'Enter the model ID from ModelScope (format: organization/model-name)'}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Model download will use the{' '}
                                {repoPlatform === 'huggingface'
                                  ? 'HF_ENDPOINT'
                                  : 'MODELSCOPE_DOMAIN'}{' '}
                                configured in .env file.
                              </p>
                            </div>
                          )}

                          {/* Upload Model */}
                          {modelSelectionType === 'upload' && (
                            <div className="grid gap-2 pt-2">
                              <Label htmlFor="upload-model">
                                Model ZIP File
                              </Label>
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
                                      validateAndSetCustomModel(
                                        e.target.files[0],
                                      )
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
                                        <p className="max-w-50 truncate text-sm font-medium">
                                          {
                                            isCustomModel(addWorkload.metadata)
                                              ?.name
                                          }
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                          {formatFileSize(
                                            isCustomModel(addWorkload.metadata)
                                              ?.size || 0,
                                          )}
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

                          {/* Custom Model Directory */}
                          {modelSelectionType === 'directory' && (
                            <div className="grid gap-2 pt-2">
                              <Label htmlFor="model-dir">Custom Model</Label>
                              <Select
                                onValueChange={handleModelChange}
                                value={addWorkload.model ?? undefined}
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
                          )}
                        </div>

                        {/* Device Selection */}
                        <div className="grid gap-2">
                          <Label htmlFor="device">Device</Label>
                          <div id="device">
                            {availableDevices.map((device) => (
                              <div
                                key={device.id}
                                className="flex items-center"
                              >
                                <input
                                  type="checkbox"
                                  id={device.id}
                                  value={device.id}
                                  checked={addWorkload.devices?.some(
                                    (d) => d.device === device.id,
                                  )}
                                  onChange={(e) =>
                                    handleDeviceChange(
                                      device.id,
                                      e.target.checked,
                                    )
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
                          {addWorkload.devices &&
                            addWorkload.devices.length > 0 && (
                              <div className="mt-2 rounded-md bg-gray-50 p-4 dark:bg-gray-700">
                                <Label className="mb-4">Priority order:</Label>
                                <ol className="space-y-1">
                                  {addWorkload.devices.map((item, index) => {
                                    const deviceDetails = availableDevices.find(
                                      (device) => device.id === item.device,
                                    )
                                    const deviceName =
                                      deviceDetails?.name || item.device
                                    return (
                                      <li
                                        key={index}
                                        className="flex items-center pb-4 pl-4"
                                      >
                                        <div className="bg-primary border-primary flex h-7 w-7 items-center justify-center rounded-full border">
                                          <span className="text-sm font-medium text-white">
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
                      </>
                    )}

                    {/* Submit Button */}
                    <Button
                      className="w-full"
                      onClick={() =>
                        isEdit ? handleSaveWorkload() : handleAddWorkload()
                      }
                      disabled={isLoading || isDisable}
                    >
                      {isLoading
                        ? addWorkload.task === 'custom application monitoring'
                          ? `Profiling... ${timeRemaining}s`
                          : 'Loading...'
                        : isEdit
                          ? 'Save Workload'
                          : 'Add Workload'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
