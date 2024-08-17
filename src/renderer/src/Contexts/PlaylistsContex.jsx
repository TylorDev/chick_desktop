/* eslint-disable react/prop-types */
import { createContext, useState, useContext, useEffect } from 'react'
import { ElectronGetter, ElectronSetter2 } from './utils'

const ContextLikes = createContext()

export const usePlaylists = () => useContext(ContextLikes)

export const PlaylistsProvider = ({ children }) => {
  const [metadata, setMetadata] = useState(null) // 1 ref - 5 ref

  const [playlists, setPlaylists] = useState([])

  const getAllSongs = () => ElectronGetter('get-all-audio-files', setMetadata) //1 ref
  const openM3U = () => ElectronGetter('open-m3u', setMetadata) // 0 ref
  const selectFiles = () => ElectronGetter('select-files', setMetadata) // 0 ref
  const detectM3U = () => ElectronGetter('detect-m3u', setMetadata) //   0 ref

  const getSavedLists = () => ElectronGetter('get-playlists', setPlaylists)
  const addPlaylisthistory = (path) => ElectronSetter2('add-list-to-history', path)
  const deletePlaylist = (filePath) => {
    const setState = []
    ElectronGetter('delete-playlist', setState, filePath)
  }
  const getUniqueList = (setState, filePath) => {
    ElectronGetter('open-list', setState, filePath)
  }

  useEffect(() => {
    getAllSongs()
  }, [])

  return (
    <ContextLikes.Provider
      value={{
        metadata,
        playlists,
        getSavedLists,
        addPlaylisthistory,
        deletePlaylist,
        getUniqueList,
        getAllSongs,
        openM3U,
        selectFiles,
        detectM3U
      }}
    >
      {children}
    </ContextLikes.Provider>
  )
}