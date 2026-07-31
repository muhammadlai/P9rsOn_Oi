#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import https from 'https'
import { createHash } from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const execAsync = promisify(exec)

// Configuration
const ONNX_RUNTIME_VERSION = '1.21.0'
const MODEL_NAME = 'intfloat/multilingual-e5-small'
const MODEL_REVISION = '614241f622f53c4eeff9890bdc4f31cfecc418b3'
const BACKEND_DIR = path.join(__dirname, '..', 'backend')
const MODELS_DIR = path.join(BACKEND_DIR, 'models')
const LIB_DIR = path.join(BACKEND_DIR, 'lib')

// Platform-specific library configurations
const PLATFORMS = {
  'win32-x64': {
    url: `https://github.com/microsoft/onnxruntime/releases/download/v${ONNX_RUNTIME_VERSION}/onnxruntime-win-x64-${ONNX_RUNTIME_VERSION}.zip`,
    libFile: 'onnxruntime.dll',
    extractPath: `onnxruntime-win-x64-${ONNX_RUNTIME_VERSION}/lib/onnxruntime.dll`,
  },
  'linux-x64': {
    url: `https://github.com/microsoft/onnxruntime/releases/download/v${ONNX_RUNTIME_VERSION}/onnxruntime-linux-x64-${ONNX_RUNTIME_VERSION}.tgz`,
    libFile: 'libonnxruntime.so',
    extractPath: `onnxruntime-linux-x64-${ONNX_RUNTIME_VERSION}/lib/libonnxruntime.so`,
  },
  'darwin-arm64': {
    url: `https://github.com/microsoft/onnxruntime/releases/download/v${ONNX_RUNTIME_VERSION}/onnxruntime-osx-arm64-${ONNX_RUNTIME_VERSION}.tgz`,
    libFile: 'libonnxruntime.dylib',
    extractPath: `onnxruntime-osx-arm64-${ONNX_RUNTIME_VERSION}/lib/libonnxruntime.dylib`,
  },
  'darwin-x64': {
    url: `https://github.com/microsoft/onnxruntime/releases/download/v${ONNX_RUNTIME_VERSION}/onnxruntime-osx-x64-${ONNX_RUNTIME_VERSION}.tgz`,
    libFile: 'libonnxruntime.dylib',
    extractPath: `onnxruntime-osx-x64-${ONNX_RUNTIME_VERSION}/lib/libonnxruntime.dylib`,
  },
}

// Utility functions
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`Created directory: ${dir}`)
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`)
    const file = fs.createWriteStream(dest)

    https
      .get(url, response => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          return downloadFile(response.headers.location, dest)
            .then(resolve)
            .catch(reject)
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`Download failed with status: ${response.statusCode}`)
          )
          return
        }

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          console.log(`Downloaded: ${dest}`)
          resolve()
        })

        file.on('error', err => {
          fs.unlink(dest, () => {}) // Delete the file on error
          reject(err)
        })
      })
      .on('error', reject)
  })
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function extractArchive(archivePath, extractDir) {
  const ext = path.extname(archivePath)

  try {
    if (ext === '.zip') {
      // Use PowerShell on Windows, unzip on Unix
      if (process.platform === 'win32') {
        await execAsync(
          `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`
        )
      } else {
        await execAsync(`unzip -o "${archivePath}" -d "${extractDir}"`)
      }
    } else if (ext === '.tgz' || archivePath.endsWith('.tar.gz')) {
      await execAsync(`tar -xzf "${archivePath}" -C "${extractDir}"`)
    } else {
      throw new Error(`Unsupported archive format: ${ext}`)
    }

    console.log(`Extracted: ${archivePath}`)
  } catch (error) {
    throw new Error(`Failed to extract ${archivePath}: ${error.message}`)
  }
}

async function downloadOnnxRuntime() {
  console.log('Setting up ONNX Runtime libraries...')

  ensureDir(LIB_DIR)
  const tempDir = path.join(LIB_DIR, 'temp')
  ensureDir(tempDir)

  for (const [platform, config] of Object.entries(PLATFORMS)) {
    console.log(`\nDownloading ONNX Runtime for ${platform}...`)

    const platformDir = path.join(LIB_DIR, platform)
    ensureDir(platformDir)

    const archiveName = path.basename(config.url)
    const archivePath = path.join(tempDir, archiveName)
    const extractDir = path.join(tempDir, platform)
    ensureDir(extractDir)

    try {
      // Download
      await downloadFile(config.url, archivePath)

      // Extract
      await extractArchive(archivePath, extractDir)

      // Copy library file
      const sourceLib = path.join(extractDir, config.extractPath)
      const destLib = path.join(platformDir, config.libFile)

      if (fs.existsSync(sourceLib)) {
        fs.copyFileSync(sourceLib, destLib)
        console.log(`Copied library: ${destLib}`)
      } else {
        console.warn(`Library file not found: ${sourceLib}`)
      }
    } catch (error) {
      console.error(`Failed to setup ${platform}: ${error.message}`)
    }
  }

  // Clean up temp directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
    console.log('Cleaned up temporary files')
  } catch (error) {
    console.warn(`Failed to clean up temp directory: ${error.message}`)
  }
}

async function downloadModel() {
  console.log('\\nSetting up multilingual E5 model...')

  ensureDir(MODELS_DIR)
  const modelDir = path.join(MODELS_DIR, 'minilm')
  ensureDir(modelDir)

  const baseUrl = `https://huggingface.co/${MODEL_NAME}/resolve/${MODEL_REVISION}/onnx`
  const artifacts = [
    {
      name: 'multilingual-e5-small.onnx',
      url: `${baseUrl}/model_O4.onnx`,
      sha256:
        '4654c156f3e4171abc9c716cdb771bf9116455d15ac1aab364aeeede0e3205b0',
    },
    {
      name: 'multilingual-e5-small-tokenizer.json',
      url: `${baseUrl}/tokenizer.json`,
      sha256:
        '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39',
    },
  ]

  for (const artifact of artifacts) {
    const destination = path.join(modelDir, artifact.name)
    if (fs.existsSync(destination)) {
      const existingDigest = await sha256File(destination)
      if (existingDigest === artifact.sha256) {
        console.log(`Keeping existing embedding artifact: ${destination}`)
        continue
      }
      console.warn(`Replacing invalid embedding artifact: ${destination}`)
      fs.rmSync(destination, { force: true })
    }
    await downloadFile(artifact.url, destination)
    const digest = await sha256File(destination)
    if (digest !== artifact.sha256) {
      fs.rmSync(destination, { force: true })
      throw new Error(`Checksum mismatch for ${artifact.name}`)
    }
  }
}

async function main() {
  console.log('Setting up embeddings dependencies...')

  try {
    await downloadOnnxRuntime()
    await downloadModel()

    console.log('\\n✅ Embeddings setup completed!')
    console.log('\\nNext steps:')
    console.log('1. Build the Go backend with the pinned multilingual artifacts')
    console.log('2. Verify electron-builder includes backend/models')
    console.log('3. Run the backend and test Memory/RAG retrieval')
  } catch (error) {
    console.error('\\n❌ Setup failed:', error.message)
    process.exit(1)
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
