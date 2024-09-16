import { createContext, useContext, useState } from 'react'
import { ElectronDelete, ElectronGetter, ElectronGetter2, ElectronSetter } from './utils'

// Crear el contexto
const MiniContext = createContext()

// Proveedor del contexto
// eslint-disable-next-line react/prop-types
export const MiniProvider = ({ children }) => {
  const [recents, setRecents] = useState([])
  const [most, setMost] = useState([])
  const [results, setResults] = useState([])
  const [directories, setDiretories] = useState([])
  const [history, setHistory] = useState([])
  const [later, setLater] = useState([])
  const [lista, setLista] = useState([])

  // Función para agregar un elemento al final de la lista
  function agregarElemento(elemento) {
    setLista([...lista, elemento])
  }

  // Función para eliminar un elemento por su índice
  function eliminarElemento(elemento) {
    setLista(lista.filter((item) => item !== elemento))
  }

  const getRecents = () => ElectronGetter('get-recents', setRecents, null, 'Recientes obtenidos!')

  const getMost = () => ElectronGetter('get-most-played', setMost, null, 'Mas eschados cargados!')
  const searchSongs = (value) => ElectronGetter2('search', setResults, value)
  const getDirectories = () =>
    ElectronGetter('get-all-directories', setDiretories, null, 'directorios obtenidos!')
  const deleteDirectory = async (path) => {
    await ElectronDelete('delete-directory', path, 'directorio eliminado!')
    setDiretories((preDir) => preDir.filter((dir) => dir.path !== path))
  }
  const addDirectory = async () => {
    await ElectronGetter('add-directory', null, null, 'Directorio agregado!') // 0 ref
    getDirectories()
  }
  const getDirFiles = (setState, value) => {
    ElectronGetter2('get-audio-in-directory', setState, value)
  }

  const getHistory = () => ElectronGetter('get-history', setHistory, null, 'se obtuvo el historial')
  const getlatersongs = () =>
    ElectronGetter('get-listen-later', setLater, null, 'listen later cargados!')
  const removelatersong = (common) => ElectronSetter('remove-listen-later', common, getlatersongs)
  const latersong = (common) => ElectronSetter('listen-later-song', common)

  return (
    <MiniContext.Provider
      value={{
        recents, //     LISTA RECIENTES
        getRecents, //  OBTIENE LA  LISTA RECIENTES

        most, //      LISTA MAS POPULARES
        getMost, //      OBTIENE LA LISTA  MAS POPULARES

        results, // LISTA BARRA DE BUSQUEDA
        searchSongs, // BUSCA CANCIONES EN LA BD

        directories, // LISTA DIRECTORIOS
        addDirectory,
        getDirectories, //  OBTIENE LA  LISTA DIRECTORIOS
        deleteDirectory, // borra un directorio especifico
        getDirFiles,
        history, // LISTA DE HISTORIAL
        getHistory, //  OBTIENE LA  LISTA DE HISTORIAL

        later, //  LISTA MAS TARDE
        getlatersongs, //  OBTIENE LA LISTA MAS TARDE
        removelatersong, // QUITA UNA CANCION DE ESCUCHAR MAS TARDE
        latersong, // agrega una cancion a la LISTA MAS TARDE
        lista, // lista personalizada
        agregarElemento,
        eliminarElemento
      }}
    >
      {children}
    </MiniContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useMini = () => useContext(MiniContext)
