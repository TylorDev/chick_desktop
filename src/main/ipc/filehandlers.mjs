import { dialog, ipcMain } from 'electron'

import {
  getFileInfos,
  getAllAudioFiles,
  getOrCreateSong,
  getTotalDuration
} from './utils/utils.mjs'

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { sendNotification } from '../index.mjs'
import { setBraveVolume } from './audio.mjs'
const prisma = new PrismaClient()
const watchedDirectories = new Set()

async function startWatchingDirectories() {
  try {
    console.log('Starting')
    const directories = await prisma.directory.findMany()

    directories.forEach(({ path }) => {
      watchDirectory(path)
    })
  } catch (error) {
    console.error('Error al obtener los directorios:', error)
  }
}

function watchDirectory(dirPath) {
  if (watchedDirectories.has(dirPath)) {
    console.debug(`El directorio ${dirPath} ya está siendo vigilado.`)
    return
  }

  try {
    fs.watch(dirPath, (eventType, filename) => handleFileChange(eventType, filename, dirPath))
    watchedDirectories.add(dirPath)
    console.debug(`Vigilando el directorio: ${dirPath}`)
  } catch (error) {
    console.error(`Error al intentar vigilar el directorio ${dirPath}:`, error)
  }
}

function handleFileChange(eventType, filename, dirPath) {
  if (eventType !== 'rename' || !filename) return

  const fullPath = buildFullPath(filename, dirPath)
  if (isFile(fullPath)) {
    const basenameWithoutExt = extractBasename(filename)
    getOrCreateSong(fullPath, basenameWithoutExt)
    debugFileDetails(fullPath, basenameWithoutExt)
  }
}

function buildFullPath(filename, dirPath) {
  return path.join(dirPath, filename)
}

function isFile(fullPath) {
  return fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()
}

function extractBasename(filename) {
  return path.parse(filename).name
}

function debugFileDetails(fullPath, basenameWithoutExt) {
  sendNotification(`[new]`)
  console.debug(`Archivo detectado:`)
  console.debug(`Ruta completa: ${fullPath}`)
  console.debug(`Basename sin extensión: ${basenameWithoutExt}`)
}

export function setupFilehandlers() {
  startWatchingDirectories()
  const filePath = 'C:\\Users\\yonte\\Pictures\\señal.txt'

  if (fs.existsSync(filePath)) {
    console.log(`El archivo existe, comenzando a vigilar: ${filePath}`)

    // Vigilar el archivo
    fs.watch(filePath, (eventType, filename) => {
      if (filename) {
        // Leer el contenido del archivo
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            console.error(`Error al leer el archivo: ${err}`)
            return
          }

          // Eliminar el BOM si está presente
          if (data.startsWith('\ufeff')) {
            data = data.slice(1)
          }

          if (data) {
            setBraveVolume(0.2)
          } else {
            setBraveVolume(1)
          }
        })
      }
    })

    console.log(`Vigilando el txt: ${filePath}`)
  } else {
    console.log(`El archivo no existe: ${filePath}`)
  }

  ipcMain.handle('add-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return null // O manejar la cancelación según sea necesario
      }
      const directoryPath = result.filePaths[0]

      // Upsert en Prisma para agregar o actualizar el directorio
      await prisma.directory.upsert({
        where: { path: directoryPath },
        update: {},
        create: { path: directoryPath }
      })

      return { success: true, message: 'Directory added sucessfully.' }
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  ipcMain.handle('get-new-audio-files', async () => {
    try {
      // Obtener las últimas 5 canciones de la base de datos, ordenadas por timestamp
      const recentAudioFiles = await prisma.songs.findMany({
        orderBy: {
          timestamp: 'desc'
        },
        select: {
          filepath: true
        },
        take: 5
      })

      const filepathsArray = recentAudioFiles.map((song) => song.filepath)
      return getFileInfos(filepathsArray)
    } catch (error) {
      console.error('Error retrieving latest audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files', async (event, currentPage) => {
    try {
      const directories = await prisma.directory.findMany()

      if (!directories.length) return [] // Si no hay directorios, devolver array vacío

      const allAudioFiles = directories.flatMap((dir) => getAllAudioFiles(dir.path))
      const uniqueAudioFiles = [...new Set(allAudioFiles)]

      // // Configuración de paginación
      // const pageSize = 10 // Número de elementos por página
      // const totalPages = Math.ceil(uniqueAudioFiles.length / pageSize)

      // // Validar la página actual
      // if (currentPage > totalPages) return null

      // // Obtener los archivos de la página actual
      // const paginatedAudioFiles = uniqueAudioFiles.slice(
      //   (currentPage - 1) * pageSize,
      //   currentPage * pageSize
      // )

      return getFileInfos(uniqueAudioFiles)
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files-number', async () => {
    try {
      const directories = await prisma.directory.findMany()
      if (!directories.length) return 0

      const allAudioFiles = directories.flatMap((dir) => getAllAudioFiles(dir.path))
      const uniqueAudioFiles = [...new Set(allAudioFiles)]

      return uniqueAudioFiles.length
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-in-directory', async (_, directoryPath) => {
    try {
      console.log('directory', directoryPath)
      const directory = await prisma.directory.findUnique({
        where: { path: directoryPath }
      })

      if (!directory) {
        return [] // El directorio no existe en la base de datos, devolver un array vacío
      }

      // Obtener todos los archivos de audio del directorio específico
      const audioFiles = getAllAudioFiles(directoryPath)

      // Filtrar archivos duplicados
      const uniqueAudioFiles = Array.from(new Set(audioFiles))

      return getFileInfos(uniqueAudioFiles)
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
      throw error
    }
  })

  ipcMain.handle('delete-directory', async (event, path) => {
    try {
      // Eliminar el directorio por su ruta
      await prisma.directory.delete({
        where: { path: path }
      })
      return { success: true, message: 'Directory deleted successfully.' }
    } catch (error) {
      console.error('Error deleting directory:', error)
      return { success: false, message: 'Error deleting directory.' }
    }
  })

  ipcMain.handle('get-directory-by-path', async (event, path) => {
    try {
      // Obtener el directorio con un path específico
      const directory = await prisma.directory.findUnique({
        where: { path }
      })

      if (!directory) {
        throw new Error('Directory not found')
      }

      // Obtener las propiedades totalTracks y totalDuration
      const { totalTracks, totalDuration } = await getTotalDuration(directory.path)

      return {
        ...directory,
        totalTracks,
        totalDuration
      }
    } catch (error) {
      console.error('Error retrieving directory:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-directories', async () => {
    try {
      // Obtener todos los directorios de la base de datos
      const directories = await prisma.directory.findMany()

      // Iterar sobre cada directorio y agregar las propiedades totalTracks y totalDuration
      const directoriesWithDetails = await Promise.all(
        directories.map(async (directory) => {
          const { totalTracks, totalDuration } = await getTotalDuration(directory.path)

          return {
            ...directory,
            totalTracks,
            totalDuration
          }
        })
      )

      return directoriesWithDetails
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })
}
