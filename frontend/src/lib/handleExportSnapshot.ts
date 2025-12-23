// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { RefObject } from 'react'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const callback = () => resolve()
    setTimeout(callback, ms)
  })
}

export interface PDFExportOptions {
  workloadId: number
  workloadRef: RefObject<HTMLDivElement | null>
  router: {
    push: (path: string) => void
  }
}

export async function exportWorkloadToPDF({
  workloadId,
  workloadRef,
  router,
}: PDFExportOptions): Promise<void> {
  let tempContainer: HTMLElement | null = null
  try {
    //overlay indicater
    const loading = document.createElement('div')
    loading.id = 'export-indicator'
    loading.style.position = 'fixed'
    loading.style.top = '0'
    loading.style.left = '0'
    loading.style.width = '100vw'
    loading.style.height = '100vh'
    loading.style.background = 'rgba(255,255,255,0.7)'
    loading.style.zIndex = '99999'
    loading.style.display = 'flex'
    loading.style.alignItems = 'center'
    loading.style.justifyContent = 'center'
    loading.innerHTML = `<div style="font-size:2rem;font-weight:bold;color:var(--primary)">Exporting...</div>`

    document.body.appendChild(loading)

    tempContainer = document.createElement('div')
    tempContainer.style.width = '1300px'
    tempContainer.style.height = 'auto'
    tempContainer.style.position = 'fixed'
    tempContainer.style.top = '-9999px'
    tempContainer.style.left = '-9999px'
    document.body.appendChild(tempContainer)

    // Capture system monitor content
    const sysMonitorImg = await captureSystemMonitorSidebar(tempContainer)

    // Capture workload content
    const workloadImg = await captureWorkload(workloadRef, tempContainer)

    // Capture system information
    const sysInfoImg = await captureSystemInfo(
      workloadId,
      tempContainer,
      router,
    )
    // Generate PDF
    await generatePDF(sysMonitorImg, workloadImg, sysInfoImg, workloadId)

    if (loading && document.body.contains(loading)) {
      document.body.removeChild(loading)
    }
  } catch (err) {
    toast.error('Failed to generate PDF. Please try again later.')
    console.error(err)
    router.push(`/workload/${workloadId}`)
  } finally {
    // Cleanup
    if (tempContainer && document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer)
    }
  }
}

async function captureSystemMonitorSidebar(
  tempContainer: HTMLElement,
): Promise<string> {
  let sysMonitorSidebar = document.querySelector(
    '[data-sidebar="system-monitor"]',
  ) as HTMLElement

  if (!sysMonitorSidebar) {
    const sidebarBtn = Array.from(document.querySelectorAll('button'))
    const sysMonBtn = sidebarBtn.find((btn) =>
      btn.textContent?.includes('System Monitor'),
    )
    if (sysMonBtn) {
      sysMonBtn.click()
      await sleep(100)
      sysMonitorSidebar = document.querySelector(
        '[data-sidebar="system-monitor"]',
      ) as HTMLElement
      if (!sysMonitorSidebar) {
        toast.error(
          'Please open the System Monitor sidebar manually, then try export again.',
        )
        throw new Error('System Monitor sidebar not found')
      }
    }

    await sleep(6000)
  }

  const areChartLoadingGone = (): boolean => {
    const loadingByIds = sysMonitorSidebar.querySelectorAll(
      '[id="gpu-loading"], [id="gpu-memory-loading"], [id="npu-loading"]',
    )

    const hasLoadingText = Array.from(
      sysMonitorSidebar.querySelectorAll('.chart'),
    ).some(
      (chart) =>
        chart.textContent?.toLowerCase().includes('loading') ||
        chart.textContent?.toLowerCase().includes('fetching'),
    )
    return loadingByIds.length === 0 && !hasLoadingText
  }

  // Wait for loading graphs to disappear
  while (!areChartLoadingGone()) {
    await sleep(200)
  }

  const wrapper = document.createElement('div')
  wrapper.style.width = '950px'
  wrapper.style.height = 'auto'

  const oriSidebarClone = sysMonitorSidebar.cloneNode(true) as HTMLElement
  oriSidebarClone.style.background = '#fff'
  oriSidebarClone.style.overflow = 'visible'

  const sidebarClone = document.createElement('div')
  sidebarClone.append(oriSidebarClone)

  const searchBar = sidebarClone.querySelector('.search-bar')
  if (searchBar) {
    searchBar.remove()
  }

  const sidebarHeader = sidebarClone.querySelector('.header')
  if (sidebarHeader) {
    ;(sidebarHeader as HTMLElement).style.marginBottom = '0'
    ;(sidebarHeader as HTMLElement).style.paddingBottom = '0'
    ;(sidebarHeader as HTMLElement).style.borderBottom = 'none'
    ;(sidebarHeader as HTMLElement).style.gap = '0'
  }

  const sidebarContent =
    sidebarClone.querySelector('.system-utilization-charts') || sidebarClone
  if (sidebarContent) {
    ;(sidebarContent as HTMLElement).style.marginTop = '0'
    ;(sidebarContent as HTMLElement).style.paddingTop = '0'
  }

  const chartElements = Array.from(sidebarClone.querySelectorAll('.chart'))
  chartElements.forEach((c) => c.parentElement?.removeChild(c))

  const chartLayout = document.createElement('div')
  chartLayout.style.display = 'flex'
  chartLayout.style.flexDirection = 'column'
  chartLayout.style.gap = '30px'
  chartLayout.style.width = '100%'
  sidebarContent.appendChild(chartLayout)

  let rowDiv: HTMLDivElement | null = null

  chartElements.forEach((chartEl, idx) => {
    chartEl.querySelectorAll('script').forEach((script) => script.remove())

    chartEl.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
        }

        if (name === 'href' || name === 'src' || name === 'xlink:href') {
          const value = attr.value.toLowerCase().trim()

          if (value.startsWith('javascript:')) {
            el.removeAttribute(attr.name)
          }
          if (value.startsWith('data:')) {
            if (
              value.startsWith('data:image/') &&
              value.includes('text/html') &&
              value.includes('<') &&
              value.includes('&lt;')
            ) {
              el.removeAttribute(attr.name)
            }
          }
        }
      })
    })

    if (idx % 2 === 0) {
      rowDiv = document.createElement('div')
      rowDiv.style.display = 'flex'
      rowDiv.style.flexDirection = 'row'
      rowDiv.style.gap = '80px'
      rowDiv.style.marginBottom = '30px'
      rowDiv.style.justifyContent = 'center'
      rowDiv.querySelectorAll('script').forEach((s) => s.remove())
      rowDiv.querySelectorAll('*').forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name.toLowerCase().startsWith('on'))
            el.removeAttribute(attr.name)
        })
      })
      chartLayout.appendChild(rowDiv)
    }

    const chartClone = chartEl.cloneNode(true) as HTMLElement

    chartClone.style.width = '350px'
    chartClone.style.maxWidth = '350px'
    chartClone.style.minWidth = '350px'
    chartClone.style.height = 'auto'
    chartClone.style.display = 'flex'
    chartClone.style.justifyContent = 'center'
    chartClone.style.alignItems = 'center'
    chartClone.style.marginTop = '0'

    chartClone.querySelectorAll('script').forEach((s) => s.remove())
    chartClone.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on'))
          el.removeAttribute(attr.name)
      })
    })

    const chartWrapper = document.createElement('div')
    chartWrapper.append(chartClone)
    rowDiv?.appendChild(chartWrapper.firstElementChild as HTMLElement)
  })
  wrapper.appendChild(sidebarClone)
  tempContainer.appendChild(wrapper)

  const canvas = await html2canvas(sidebarClone, {
    useCORS: true,
    scale: 3,
    width: sidebarClone.scrollWidth,
    height: sidebarClone.scrollHeight + 100,
    logging: false,
  })

  tempContainer.innerHTML = ''
  return canvas.toDataURL('image/jpeg', 1.0)
}

async function captureWorkload(
  workloadRef: RefObject<HTMLDivElement | null>,
  tempContainer: HTMLElement,
): Promise<string> {
  if (!workloadRef.current) {
    toast.error('Workload was not rendered properly.')
    throw new Error('Workload reference not found')
  }
  const workloadClone = workloadRef.current.cloneNode(true) as HTMLElement
  workloadClone.style.height = 'auto'
  workloadClone.style.overflow = 'visible'
  workloadClone.style.width = '1300px'

  const exportBtn = workloadClone.querySelector('button, .exportBtn')
  if (exportBtn && exportBtn.textContent?.toLowerCase().includes('export')) {
    exportBtn.remove()
  }

  const chartContainers = workloadClone.querySelectorAll(
    '.chart-container, .recharts-wrapper',
  )
  chartContainers.forEach((el) => {
    ;(el as HTMLElement).style.width = '1200px'
    ;(el as HTMLElement).style.maxWidth = '1200px'
    ;(el as HTMLElement).style.minWidth = '1200px'
  })

  const overflowElements = workloadClone.querySelectorAll('[style*="overflow"]')
  overflowElements.forEach((el) => {
    ;(el as HTMLElement).style.overflow = 'visible'
    ;(el as HTMLElement).style.height = 'auto'
  })

  tempContainer.appendChild(workloadClone)

  const canvas = await html2canvas(workloadClone, {
    logging: false,
    useCORS: true,
    scale: 3,
    width: tempContainer.scrollWidth,
    height: tempContainer.scrollHeight + 100,
    windowHeight: tempContainer.scrollHeight + 100,
    windowWidth: tempContainer.scrollWidth,
  })

  tempContainer.innerHTML = ''
  return canvas.toDataURL('image/jpeg', 1.0)
}

async function captureSystemInfo(
  workloadId: number,
  tempContainer: HTMLElement,
  router: { push: (path: string) => void },
): Promise<{ imgData: string; height: number }> {
  router.push('/system/information')

  let systemInfoElement: HTMLElement | null = null
  let attempts = 0
  while (attempts < 50) {
    await sleep(200)
    systemInfoElement = document.querySelector('.container')
    if (
      systemInfoElement &&
      (systemInfoElement.textContent?.includes('Platform:') ||
        systemInfoElement.textContent?.includes('Physical Cores:') ||
        systemInfoElement.textContent?.includes('Model:')) &&
      !systemInfoElement.textContent?.toLowerCase().includes('loading')
    ) {
      break
    }
    attempts++
  }

  if (!systemInfoElement) {
    toast.error('System information was not rendered.')
    throw new Error('System info element not found')
  }

  const clone = systemInfoElement.cloneNode(true) as HTMLElement
  clone.style.width = '1300px'
  clone.style.height = 'auto'
  clone.style.overflow = 'visible'

  const overflowElements = clone.querySelectorAll(
    '[style*="overflow"], [style*="height"], [style*="max-height"]',
  )
  overflowElements.forEach((el) => {
    ;(el as HTMLElement).style.overflow = 'visible'
    ;(el as HTMLElement).style.height = 'auto'
    ;(el as HTMLElement).style.maxHeight = 'none'
    ;(el as HTMLElement).style.paddingBottom = '100px'
  })

  // Function to count GPUs
  const gpuCard = clone.querySelector('#gpu-container')
  const totalGPUs = 0

  const countGPUs = (): number => {
    if (!gpuCard) return 0
    const gpuItems = Array.from(
      gpuCard.querySelectorAll('[id^="gpu-item-"]'),
    ).filter(
      (item) =>
        item.textContent?.includes('Model:') &&
        item.textContent?.includes('Device:'),
    )
    return gpuItems.length
  }

  if (gpuCard) {
    const totalGPUs = countGPUs()
    const gpuCardElement = gpuCard as HTMLElement

    // adding page break before the GPU card
    const pageBreak = document.createElement('div')
    pageBreak.style.height = '250px'
    pageBreak.style.breakBefore = 'page'
    pageBreak.style.visibility = 'hidden'

    gpuCard.parentNode?.insertBefore(pageBreak, gpuCard)

    gpuCardElement.style.breakBefore = 'page'
    gpuCardElement.style.breakInside = 'avoid'
    gpuCardElement.style.marginTop = '20px'

    if (totalGPUs > 8) {
      const calculatedMargin = Math.max(50, 290 - totalGPUs * 10)
      gpuCardElement.style.marginBottom = `${calculatedMargin}px`
    } else {
      gpuCardElement.style.marginBottom = '2px'
    }
  }

  // Handle NPU Containers by moving to a new page
  const npuContainer = clone.querySelector('#npu-container')
  if (npuContainer) {
    const npuElement = npuContainer as HTMLElement

    if (totalGPUs > 8) {
      // Move NPU to new page
      const npuPageBreak = document.createElement('div')
      npuPageBreak.style.height = '50px'
      npuPageBreak.style.breakBefore = 'page'
      npuPageBreak.style.visibility = 'hidden'
      npuContainer.parentNode?.insertBefore(npuPageBreak, npuContainer)

      Object.assign(npuElement.style, {
        breakBefore: 'page',
        pageBreakBefore: 'always',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginTop: '20px',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible',
      })
    } else {
      // Keep NPU on same page
      Object.assign(npuElement.style, {
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible',
        marginTop: '30px',
        marginBottom: '10px',
      })
    }
  }

  // handle other containers normally
  const allCards = clone.querySelectorAll('div[class*="card"], .card')
  allCards.forEach((card, index) => {
    const element = card as HTMLElement
    if (card.id === 'gpu-container' || card.id === 'npu-container') {
      return
    }

    element.style.height = 'auto'
    element.style.maxHeight = 'none'
    element.style.overflow = 'visible'
    element.style.marginBottom = '15px'

    if (index > 0) {
      element.style.marginTop = '25px'
    }
  })

  tempContainer.appendChild(clone)

  const canvas = await html2canvas(tempContainer, {
    logging: false,
    useCORS: true,
    scale: 3,
    width: tempContainer.scrollWidth,
    height: tempContainer.scrollHeight + 100,
    windowHeight: tempContainer.scrollHeight + 100,
    windowWidth: tempContainer.scrollWidth,
  })

  tempContainer.innerHTML = ''
  router.push(`/workload/${workloadId}`)
  return { imgData: canvas.toDataURL('image/jpeg', 1.0), height: canvas.height }
}

async function generatePDF(
  sysMonitorImg: string,
  workloadImg: string,
  sysInfoImg: { imgData: string; height: number },
  workloadId: number,
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  })

  const portraitWidth = pdf.internal.pageSize.getWidth()
  const portraitHeight = pdf.internal.pageSize.getHeight()
  const sysMonitorImgProps = pdf.getImageProperties(sysMonitorImg)
  const sysMonitorImgHeight =
    (sysMonitorImgProps.height * portraitWidth) / sysMonitorImgProps.width

  if (sysMonitorImgHeight > portraitHeight) {
    let currentY = 0
    while (currentY < sysMonitorImgHeight) {
      if (currentY > 0) pdf.addPage('a4', 'portrait')
      pdf.addImage(
        sysMonitorImg,
        'JPEG',
        0,
        -currentY,
        portraitWidth,
        sysMonitorImgHeight,
      )
      currentY += portraitHeight
    }
  } else {
    pdf.addImage(
      sysMonitorImg,
      'JPEG',
      0,
      0,
      portraitWidth,
      sysMonitorImgHeight,
    )
  }

  // Add workload image
  pdf.addPage('a4', 'landscape')
  const landscapeWidth = pdf.internal.pageSize.getWidth()
  const landscapeHeight = pdf.internal.pageSize.getHeight()
  const workloadImgProps = pdf.getImageProperties(workloadImg)
  const workloadImgHeight =
    (workloadImgProps.height * landscapeWidth) / workloadImgProps.width
  pdf.addImage(workloadImg, 'JPEG', 0, 0, landscapeWidth, workloadImgHeight)

  //  system info image
  const sysInfoImgProps = pdf.getImageProperties(sysInfoImg.imgData)
  const sysInfoImgHeight =
    (sysInfoImgProps.height * landscapeWidth) / sysInfoImgProps.width
  if (sysInfoImgHeight > landscapeHeight) {
    // Split into multiple pages
    let currentY = 0
    while (currentY < sysInfoImgHeight) {
      pdf.addPage()
      pdf.addImage(
        sysInfoImg.imgData,
        'JPEG',
        0,
        -currentY,
        landscapeWidth,
        sysInfoImgHeight,
      )
      currentY += landscapeHeight
    }
  } else {
    pdf.addImage(
      sysInfoImg.imgData,
      'JPEG',
      0,
      0,
      landscapeWidth,
      sysInfoImgHeight,
    )
  }

  pdf.save(
    `workload-ID(${workloadId})-${new Date().toISOString().slice(0, 10)}.pdf`,
  )
}
