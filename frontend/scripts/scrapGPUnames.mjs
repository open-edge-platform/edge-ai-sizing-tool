import { execSync } from 'child_process'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const URL = 'https://dgpu-docs.intel.com/devices/hardware-table.html'
const OUTPUT_FILE = '../src/lib/supportedBackupGPUMap.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outputPath = path.resolve(__dirname, OUTPUT_FILE)

function readExisitingGPUData(){
    try{
      if (!fs.existsSync(outputPath)) {
        return {}
      }

      const content = fs.readFileSync(outputPath, 'utf-8')
      const match = content.match(/\{[\s\S]*\}/)

      if (!match){
        return {}
      }

      const jsonStr = match[0].replace(/'/g,'"').replace(/([A-Za-z0-9_]+):/g, '"$1":')
      return JSON.parse(jsonStr)
    } catch (err){
      console.log('Error reading existing map:', err)
      return {}
    }
}

async function scrapeGPUData() {
  console.log('Fetching latest GPU data from Intel documentation')
  try {
    const existingMap = readExisitingGPUData()
    console.log(`Reading existing map with ${Object.keys(existingMap).length} entries`)

    const html = execSync(`curl -s '${URL}'`).toString()
    console.log('Successfully fetched HTML content')

    const $ = cheerio.load(html)
    const table = $('table').first()

    if (!table.length) {
      throw new Error('Could not find table on the page')
    }

    const headers = []
    table.find('th').each((__, th) => {
      headers.push($(th).text().trim())
    })
    const pciIDIdx = headers.findIndex((head) => /pci.?ids?/i.test(head))
    const nameIdx = headers.findIndex((head) => /^name$/i.test(head))
    const codeNameIdx = headers.findIndex((head) => /^codename$/i.test(head))

    if (pciIDIdx === -1 || nameIdx === -1 || codeNameIdx == -1) {
      throw new Error('Could not find PCI ID or device name columnes')
    }

    const map = {}
    let updates = {added: 0, changed: 0, unchanged: 0}
    table
      .find('tr')
      .slice(1)
      .each((_, row) => {
        const cells = []
        $(row)
          .find('td')
          .each((_, td) => {
            cells.push($(td).text().trim())
          })
        if (
          cells.length &&
          cells[pciIDIdx] &&
          cells[nameIdx] &&
          cells[codeNameIdx]
        ) {
          const pciIDs = cells[pciIDIdx].split(',').map(id => id.trim())
          const gpuName = `${cells[nameIdx]} [${cells[codeNameIdx]}]`
          pciIDs.forEach(pciID => {
            if(!existingMap[pciID]){
              updates.added++
            } else if (existingMap[pciID] !== gpuName){
              updates.changed++
            } else {
              updates.unchanged++
            }
            map[pciID] = gpuName
          })
        }
      })

    const mergedMap = { ...existingMap, ...map}

    function formatWithSingleQuotes(obj, indent = 2) {
      const space = ' '.repeat(indent)
      const entries = Object.entries(obj)
        .map(
          ([key, value]) =>
            `${space}'${key}': '${String(value).replace(/'/g, "\\',")}'`,
        )
        .join(',\n')
      return `{\n${entries}\n}`
    }

    const fileContent =
      `// Scraped by scripts/scrapGPUnames.mjs\n` +
      `// Generated on ${new Date().toISOString()}\n` +
      `export const INTEL_GPU_PCI_ID_MAP: Record<string, string> = ${formatWithSingleQuotes(mergedMap)}\n`
    fs.writeFileSync(outputPath, fileContent, 'utf-8')
    try {
      execSync(`npx eslint --fix ${outputPath}`)
      console.log('ESLint fixes applied')
    } catch (err) {
      console.log('Failed to run ESLint fix:', err.message)
    }
    console.log(`GPU data saved to: ${outputPath}`)
  } catch (err) {
    console.log('Error:', err)
  }
}

scrapeGPUData()
