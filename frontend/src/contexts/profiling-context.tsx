// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export interface ProfilingData {
  pid: number
  sessionId: string
  processName?: string
  appName?: string
  appPath?: string
  duration: number
  timestamp: string
  command?: string
  results: unknown
  selectionType: 'pid' | 'appname'
  allPids: number[]
}

export interface ProfilingHistoryItem {
  pid: number
  sessionId: string
  processName?: string
  appPath?: string
  timestamp: string
  selectionType: 'pid' | 'appname'
  allPids: number[]
}

interface ProfilingContextType {
  // Current profiling session
  profilingData: ProfilingData | null
  setProfilingData: (data: ProfilingData | null) => void
  clearProfilingData: () => void

  // Multiple sessions support (keyed by PID)
  profilingSessions: Map<number, ProfilingData>
  addProfilingSession: (data: ProfilingData) => void
  getProfilingSession: (pid: number) => ProfilingData | undefined
  removeProfilingSession: (pid: number) => void
  clearAllSessions: () => void

  // History tracking (last 10 sessions)
  profilingHistory: ProfilingHistoryItem[]
  addToHistory: (item: ProfilingHistoryItem) => void
  clearHistory: () => void
}

const ProfilingContext = createContext<ProfilingContextType | undefined>(
  undefined,
)

export function ProfilingProvider({ children }: { children: React.ReactNode }) {
  const [profilingData, setProfilingDataState] = useState<ProfilingData | null>(
    null,
  )
  const [profilingSessions, setProfilingSessions] = useState<
    Map<number, ProfilingData>
  >(new Map())
  const [profilingHistory, setProfilingHistory] = useState<
    ProfilingHistoryItem[]
  >([])

  const setProfilingData = useCallback((data: ProfilingData | null) => {
    setProfilingDataState(data)
  }, [])

  const clearProfilingData = useCallback(() => {
    setProfilingDataState(null)
  }, [])

  const addProfilingSession = useCallback((data: ProfilingData) => {
    setProfilingSessions((prev) => {
      const newMap = new Map(prev)
      newMap.set(data.pid, data)
      return newMap
    })
  }, [])

  const getProfilingSession = useCallback(
    (pid: number) => {
      return profilingSessions.get(pid)
    },
    [profilingSessions],
  )

  const removeProfilingSession = useCallback((pid: number) => {
    setProfilingSessions((prev) => {
      const newMap = new Map(prev)
      newMap.delete(pid)
      return newMap
    })
  }, [])

  const clearAllSessions = useCallback(() => {
    setProfilingSessions(new Map())
  }, [])

  const addToHistory = useCallback((item: ProfilingHistoryItem) => {
    setProfilingHistory((prev) => {
      // Add to beginning and keep only last 10
      const newHistory = [item, ...prev].slice(0, 10)
      return newHistory
    })
  }, [])

  const clearHistory = useCallback(() => {
    setProfilingHistory([])
  }, [])

  return (
    <ProfilingContext.Provider
      value={{
        profilingData,
        setProfilingData,
        clearProfilingData,
        profilingSessions,
        addProfilingSession,
        getProfilingSession,
        removeProfilingSession,
        clearAllSessions,
        profilingHistory,
        addToHistory,
        clearHistory,
      }}
    >
      {children}
    </ProfilingContext.Provider>
  )
}

export function useProfilingContext() {
  const context = useContext(ProfilingContext)
  if (context === undefined) {
    throw new Error(
      'useProfilingContext must be used within a ProfilingProvider',
    )
  }
  return context
}
