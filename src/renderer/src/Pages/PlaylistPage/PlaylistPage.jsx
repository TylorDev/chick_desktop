import { useParams } from 'react-router-dom'
import './PlaylistPage.scss'
import { useState } from 'react'
import { useEffect } from 'react'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from './../../Components/Cola/Cola'
import { formatDuration, formatTimestamp } from './../../../timeUtils'
import { Button } from './../../Components/Button/Button'
import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { GoPencil } from 'react-icons/go'
import { useSuper } from '../../Contexts/SupeContext'
import Modal from '../../Components/Modal/Modal'
import PlaylistForm from './../../Components/PlaylistForm/PlaylistForm'
import { BinToBlob } from './../../Contexts/utils'
function PlaylistPage() {
  const { dir } = useParams() // Obtener el parámetro de la URL
  const [current, setCurrent] = useState([])
  const [isVisible, setIsVisible] = useState(false) // Moved to the top

  const { getUniqueList, updatePlaylist, playlists } = usePlaylists()
  const { queueState, handleQueueAndPlay } = useSuper() // Combined the two useSuper calls

  useEffect(() => {
    getUniqueList(setCurrent, dir)
  }, [dir, queueState, playlists])

  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  if (!current || !current.playlistData) {
    return <div>Cargando...</div> // O un mensaje adecuado de "cargando"
  }

  const data = current.playlistData
  return (
    <div className="PlaylistPage">
      <Modal isVisible={isVisible} closeModal={closeModal}>
        <PlaylistForm
          playlist={current.playlistData}
          onUpdate={updatePlaylist}
          close={closeModal}
        />
      </Modal>
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img src={BinToBlob(current.images.image1)} alt="" />
            <img src={BinToBlob(current.images.image2)} alt="" />
            <img src={BinToBlob(current.images.image3)} alt="" />
            <img src={BinToBlob(current.images.image4)} alt="" />
          </div>
          <div className="pgl-name">{data.nombre}</div>

          <div className="pgl-time">{formatTimestamp(data.createdAt)}</div>
          <div className="pgl-data">
            <span>{data.totalplays} vistas •</span>
            <span> {data.numElementos} pistas •</span>
            <span> {formatDuration(data.duracion)} </span>
          </div>
          <div className="pgl-buttton">
            <Button onClick={openModal}>
              <GoPencil />{' '}
            </Button>
            <Button
              onClick={async () => {
                await handleQueueAndPlay(undefined, undefined, data.path)
                // console.log('Nombre en PlaylistPagePlayClick: ' + (data.path || '[sin nombre]'))
              }}
            >
              <FaPlay />
            </Button>
            <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={current.processedData} name={dir} filePath={dir} />
      </div>
    </div>
  )
}
export default PlaylistPage
