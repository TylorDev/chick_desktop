import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { fileURLToPath } from 'url'
import icon from '../../resources/icon.png?asset'
import { parseFile } from 'music-metadata'
import fs from 'fs'
import path from 'path'
import { load } from 'cheerio'

import axios from 'axios'
const fetchSongData = async (query) => {
  try {
    const response = await axios.get(
      `https://songdata.io/search?query=${encodeURIComponent(query)}`
    )
    const html = response.data

    // Usar cheerio para parsear el HTML
    const $ = load(html)

    // Obtener el primer <td> con clase "table_object"
    const firstTableObject = $('tbody .table_object').first()

    // Obtener nombre, artista y bpm
    const nameElement = firstTableObject.find('.table_name').first()
    const artistElement = firstTableObject.find('.table_artist').first()
    const trackBpm = firstTableObject.find('.table_bpm').first()

    // Extraer y devolver el texto
    return {
      Name: nameElement.text().trim() || 'No name found',
      Artist: artistElement.text().trim() || 'No artist found',
      BPM: trackBpm.text().trim() || 'No bpm found'
    }
  } catch (error) {
    console.error('Error fetching the data:', error)
    return {
      Name: 'Error',
      Artist: 'Error',
      BPM: 'Error'
    }
  }
}

async function getFileInfoWithSongData(common) {
  try {
    const filePath = common.filePath
    const { format } = await parseFile(filePath)
    const fileName = path.basename(filePath, path.extname(filePath))
    const duration = format.duration || 'Unknown'

    const query = (() => {
      if (common.title && common.artist) {
        return `${common.title}-${common.artist}`
      } else if (!common.title && common.artist) {
        return `${fileName}-${common.artist}`
      } else if (common.title && !common.artist) {
        return common.title
      } else {
        return fileName
      }
    })()

    // Obtener datos de la canción
    const songData = await fetchSongData(query)
    console.error(songData)

    return {
      fileName,
      duration,
      ...songData,
      ...common
    }
  } catch (error) {
    console.error(`Error processing file ${common.filePath}:`, error)
    return null
  }
}

async function getFileInfos(filePaths) {
  return Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const stats = fs.statSync(filePath)
        const { common, format } = await parseFile(filePath)
        const fileName = path.basename(filePath, path.extname(filePath))
        const duration = format.duration || 'Unknown'

        return {
          filePath,
          fileName,
          size: stats.size,
          duration,
          ...common
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error)
        return null
      }
    })
  ).then((fileInfos) => fileInfos.filter((info) => info !== null))
}

async function processM3UFile(m3uFilePath, baseDir) {
  try {
    // Lee el contenido del archivo M3U
    const fileContent = await fs.promises.readFile(m3uFilePath, 'utf-8')
    const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')

    // Convierte rutas relativas a rutas absolutas
    const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))

    // Usa getFileInfos para obtener los metadatos de los archivos listados en el M3U
    return getFileInfos(absolutePaths)
  } catch (error) {
    console.error('Error processing M3U file:', error)
    return []
  }
}
const audioExtensions = ['.mp3', '.wav', '.flac']
function getAllAudioFiles(dirPath) {
  let audioFiles = []

  function walkDirectory(currentPath) {
    const files = fs.readdirSync(currentPath)
    for (const file of files) {
      const fullPath = path.join(currentPath, file)
      const stats = fs.statSync(fullPath)

      if (stats.isDirectory()) {
        walkDirectory(fullPath)
      } else if (stats.isFile() && audioExtensions.includes(path.extname(fullPath))) {
        audioFiles.push(fullPath)
      }
    }
  }

  walkDirectory(dirPath)
  return audioFiles
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,

    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)), //
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  console.log(process.versions.node)

  ipcMain.on('ping', () => console.log('pong'))

  // Añadir la función de selección de archivos
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'flac'] }] // Opcional: filtrar por tipos de archivos
    })

    if (result.canceled) {
      return null // O manejar la cancelación según sea necesario
    }

    const filePath = result.filePaths[0]

    return filePath // Devuelve la URL de datos
  })

  ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath)
      const { common } = await parseFile(filePath)

      return {
        size: stats.size,
        ...common
      }
    } catch (error) {
      console.error('Error getting file info:', error)
      throw error
    }
  })

  ipcMain.handle('select-files', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return null // O manejar la cancelación según sea necesario
      }

      const directoryPath = result.filePaths[0]

      const audioFiles = getAllAudioFiles(directoryPath)
      return getFileInfos(audioFiles)
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  ipcMain.handle('open-m3u', async () => {
    try {
      // Selecciona el archivo M3U
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'M3U Files', extensions: ['m3u'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return []
      }

      const m3uFilePath = result.filePaths[0]
      const m3uDirectory = path.dirname(m3uFilePath) // Obtener la ruta del directorio del archivo M3U

      return processM3UFile(m3uFilePath, m3uDirectory)
    } catch (error) {
      console.error('Error processing M3U file:', error)
      return []
    }
  })

  ipcMain.handle('detect-m3u', async () => {
    try {
      // Selecciona un directorio
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return []
      }

      const directoryPath = result.filePaths[0]

      // Busca un archivo M3U en el directorio seleccionado
      const files = await fs.promises.readdir(directoryPath)
      const m3uFile = files.find((file) => path.extname(file).toLowerCase() === '.m3u')

      if (!m3uFile) {
        console.error('No M3U file found in the selected directory.')
        return []
      }

      const m3uFilePath = path.join(directoryPath, m3uFile)

      return processM3UFile(m3uFilePath, directoryPath)
    } catch (error) {
      console.error('Error detecting M3U file:', error)
      return []
    }
  })

  ipcMain.handle('save-m3u', async (event, filePaths) => {
    if (filePaths.length === 0) {
      console.log('No file paths provided.')
      return
    }

    // Encontrar la ruta base común
    const commonBasePath = filePaths.reduce((commonBase, filePath) => {
      if (!commonBase) return path.dirname(filePath)
      let base = path.dirname(filePath)
      while (filePath.indexOf(base) !== 0) {
        base = path.dirname(base)
        if (base === '') return commonBase
      }
      return base
    }, '')

    // Crear el contenido del archivo M3U
    const m3uContent = filePaths
      .map((filePath) => path.relative(commonBasePath, filePath))
      .join('\n')

    // Ruta del archivo M3U que se va a guardar
    const m3uFilePath = path.join(commonBasePath, 'playlist.m3u')

    // Guardar el archivo M3U
    try {
      await fs.promises.writeFile(m3uFilePath, m3uContent)
      console.log('M3U file saved successfully:', m3uFilePath)
      return { success: true, path: m3uFilePath }
    } catch (err) {
      console.error('Error writing M3U file:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('getbpm', async (event, filePath, common) => {
    try {
      const fileInfo = await getFileInfoWithSongData(filePath, common)
      return fileInfo
    } catch (error) {
      console.error(`Error in getbpm handler:`, error)
      throw error
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
