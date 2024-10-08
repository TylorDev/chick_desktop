import axios from 'axios'
import { load } from 'cheerio'
import { parseFile } from 'music-metadata'
import path from 'path'
import fs from 'fs'
import { prisma } from '../likehandlers.mjs'
import sharp from 'sharp'

export async function generateCover(files) {
  if (files.length === 0) {
    throw new Error('At least one image is required.')
  }

  // Limit to a maximum of 4 images
  const topImages = files
    .filter((file) => file.picture && file.picture[0] && file.picture[0].type !== 'Other')
    .sort((a, b) => b.play_count - a.play_count)
    .slice(0, 4)

  if (topImages.length === 0) {
    // throw new Error('No valid images to process.')
  }

  const imageBuffers = topImages.map((item) => Buffer.from(item.picture[0].data, 'base64'))

  try {
    // Resize all images to 250x250
    const resizePromises = imageBuffers.map((buffer) =>
      sharp(buffer).resize(250, 250, { fit: 'cover' }).toBuffer()
    )

    const resizedImages = await Promise.all(resizePromises)

    // Calculate the grid size based on the number of images
    const numImages = resizedImages.length
    const gridSize = Math.ceil(Math.sqrt(numImages))
    const tileSize = 250 // Each tile is 250x250
    const totalSize = gridSize * tileSize

    // Create a blank canvas
    const canvas = sharp({
      create: {
        width: totalSize,
        height: totalSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })

    // Generate composite input array
    const composites = resizedImages.map((img, index) => {
      const row = Math.floor(index / gridSize)
      const col = index % gridSize
      return {
        input: img,
        top: row * tileSize,
        left: col * tileSize
      }
    })

    const tileBuffer = await canvas.composite(composites).png().toBuffer()

    return tileBuffer
  } catch (error) {
    console.error('Error creating the cover:', error)
    throw error
  }
}

export async function getOrCreateSong(filepath, filename) {
  // Upsert the song
  const song = await prisma.songs.upsert({
    where: { filepath },
    update: {}, // No actualizamos nada si la canción ya existe
    create: { filepath, filename }
  })

  // Check if the song is newly created
  if (song.createdAt) {
    // Create UserPreferences if the song is new
    await prisma.userPreferences.create({
      data: {
        song_id: song.song_id
        // You can set other default values if needed
      }
    })
  } else {
    //
  }

  return song
}

const fechtBPM = async (query) => {
  if (!query || query.trim() === '') {
    console.debug('La canción no existe')
    return {
      Name: 'No name found',
      Artist: 'No artist found',
      bpm: '000'
    }
  }

  try {
    const response = await axios.get(
      `https://songdata.io/search?query=${encodeURIComponent(query)}`
    )
    const html = response.data

    // Usar cheerio para parsear el HTML
    const $ = load(html)

    // Verificar si existe un h2 con el texto de error
    const errorH2 = $('h2:contains("An error has occurred, please try again later.")')
    if (errorH2.length) {
      console.debug('Error message found: An error has occurred, please try again later.')
      return {
        Name: 'Error',
        Artist: 'Error',
        bpm: 'Error'
      }
    }

    // Obtener el primer <td> con clase "table_object"
    const firstTableObject = $('tbody .table_object').first()

    // Obtener nombre, artista y bpm
    const nameElement = firstTableObject.find('.table_name').first()
    const artistElement = firstTableObject.find('.table_artist').first()
    const trackBpm = firstTableObject.find('.table_bpm').first()

    // Verificar si los elementos existen y tienen texto
    if (!nameElement.length || !artistElement.length || !trackBpm.length) {
      console.debug('No se encontraron elementos con las clases esperadas.')
      return {
        Name: 'No name found',
        Artist: 'No artist found',
        bpm: '000'
      }
    }

    // Extraer y devolver el texto
    return {
      Name: nameElement.text().trim() || 'No name found',
      Artist: artistElement.text().trim() || 'No artist found',
      bpm: trackBpm.text().trim() || '000'
    }
  } catch (error) {
    console.error('Error fetching the data:', error)
    return {
      Name: 'Error',
      Artist: 'Error',
      bpm: 'Error'
    }
  }
}

export async function getFileInfo(filePath) {
  try {
    const stats = fs.statSync(filePath)
    const { common, format } = await parseFile(filePath)
    const fileName = path.basename(filePath, path.extname(filePath))
    const duration = format.duration || 0

    const song = await getOrCreateSong(filePath, fileName)

    const userPreference = await prisma.userPreferences.findUnique({
      where: { song_id: song.song_id },
      select: {
        bpm: true,
        play_count: true,
        is_favorite: true
      }
    })

    return {
      filePath,
      fileName,
      size: stats.size,
      duration,
      ...common,
      bpm: userPreference?.bpm || 0,
      play_count: userPreference?.play_count || 0,
      liked: userPreference?.is_favorite || false
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error)
    return null
  }
}

export async function getSongBpm(common) {
  try {
    const filePath = common.filePath
    const { format, fileName } = await parseFile(filePath)

    const duration = format.duration || 0

    const query = (() => {
      if (common.title && common.artist) {
        return `${common.title}-${common.artist}`
      }
      return ''
    })()

    console.debug('query:', query)
    // Obtener datos de la canción solo si la query es válida
    const songData = await fechtBPM(query)
    console.debug('resultados: ', songData)
    const bpm = songData?.bpm || 0

    console.log('BPM antes de retornar:', bpm)

    return {
      fileName,
      duration,
      ...common,
      bpm
    }
  } catch (error) {
    // console.error(`Error processing file ${common.filePath}:`, error)
    return null
  }
}

export async function getFileInfos(filePaths) {
  return Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const stats = fs.statSync(filePath)
        const { common, format } = await parseFile(filePath)
        const fileName = path.basename(filePath, path.extname(filePath))

        // Verificación para omitir archivos cuyo nombre contiene un '#'
        if (fileName.includes('#')) {
          return null
        }

        const duration = format.duration || 0

        const song = await getOrCreateSong(filePath, fileName)

        const userPreference = await prisma.userPreferences.findUnique({
          where: { song_id: song.song_id },
          select: {
            bpm: true,
            play_count: true, // Incluye play_count en la selección
            is_favorite: true
          }
        })

        return {
          filePath,
          fileName,
          size: stats.size,
          duration,
          ...common,
          // picture: [Buffer.alloc(0)], // Buffer vacío
          bpm: userPreference?.bpm || 0,
          play_count: userPreference?.play_count || 0,
          liked: userPreference?.is_favorite || false
        }
      } catch (error) {
        // console.error(`Error processing file ${filePath}:`, error)
        return null
      }
    })
  ).then((fileInfos) => fileInfos.filter((info) => info !== null))
}

export async function getFileCovers(filePaths) {
  return Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const stats = fs.statSync(filePath)
        const { common } = await parseFile(filePath)
        const fileName = path.basename(filePath, path.extname(filePath))

        const song = await getOrCreateSong(filePath, fileName)

        const userPreference = await prisma.userPreferences.findUnique({
          where: { song_id: song.song_id },
          select: {
            play_count: true // Incluye play_count en la selección
          }
        })

        return {
          ...common,

          play_count: userPreference?.play_count || 0
        }
      } catch (error) {
        // console.error(`Error processing file ${filePath}:`, error)
        return null
      }
    })
  ).then((fileInfos) => fileInfos.filter((info) => info !== null))
}

export async function getTotalDuration(directory) {
  const files = getAllAudioFiles(directory)
  const tracks = await getFileInfos(files)

  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)

  return { totalDuration, totalTracks: tracks.length }
}

export async function processPlaylist(filepath, baseDir) {
  // Lee el contenido del archivo M3U
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')

  // Convierte rutas relativas a rutas absolutas
  const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))

  // Usa getFileInfos para obtener los metadatos de los archivos listados en el M3U
  return getFileInfos(absolutePaths)
}

export async function processPlaylistCover(filepath, baseDir) {
  // Lee el contenido del archivo M3U
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')

  // Convierte rutas relativas a rutas absolutas
  const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))

  // Usa getFileInfos para obtener los metadatos de los archivos listados en el M3U
  return getFileCovers(absolutePaths)
}

const audioExtensions = ['.mp3', '.wav', '.flac']
export function getAllAudioFiles(dirPath) {
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
