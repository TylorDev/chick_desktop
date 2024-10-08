import './ListenLater.scss'

import { Button } from '../../Components/Button/Button'
import { FaPlay } from 'react-icons/fa'

import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { Cola } from '../../Components/Cola/Cola'
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { useEffect } from 'react'
import { BiShuffle } from 'react-icons/bi'
import { useMini } from '../../Contexts/MiniContext'
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { Skeleton } from '@mui/material'

function ListenLater() {
  const { handleResume, handleQueueAndPlay, toggleShuffle } = useSuper()
  const { dir } = useParams()
  const { getlatersongs, later, removelatersong } = useMini()

  useEffect(() => {
    getlatersongs()
  }, [])

  useEffect(() => {
    if (dir === 'resume' && later?.fileInfos) {
      handleResume(later.fileInfos, 'listen-later')
    }
  }, [later, dir])

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  const actions = {
    'remove from Listen later': (file) => {
      console.log('eliminando a ', file.fileName)
      removelatersong(file)
    }
  }

  if (!later.fileInfos) {
    return <LoadListenLater /> // O un mensaje adecuado de "cargando"
  }

  return (
    <div className="PlaylistPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img src={later.cover} alt="" />
          </div>
          <div className="pgl-name">{'Listen later'}</div>

          <div className="pgl-time">{formatTimestamp(Date.now())}</div>
          <div className="pgl-data">
            <span>System •</span>
            <span> {later?.fileInfos?.length} tracks •</span>
            <span> {formatDuration(later.totalDuration)} </span>
          </div>
          <div className="pgl-buttton">
            <Button
              onClick={async () => {
                await handleQueueAndPlay(later.fileInfos[0], 0, 'favourites')

                toggleShuffle()
              }}
            >
              <BiShuffle />
            </Button>
            <Button
              onClick={async () => {
                await handleQueueAndPlay(later.fileInfos[0], 0, 'listen-later')
              }}
            >
              <FaPlay />
            </Button>
            <DropdownMenu options={[]} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={later.fileInfos} name={'listen-later'} actions={actions} />
      </div>
    </div>
  )
}
export default ListenLater

function LoadListenLater() {
  return (
    <div className="PlaylistPage" id="LoadPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <Skeleton sx={{ bgcolor: 'grey.900' }} />
          </div>
          <div className="pgl-name">{'Listen later'}</div>

          <div className="pgl-time">{formatTimestamp(Date.now())}</div>
          <div className="pgl-data">
            <span>{0} views •</span>
            <span> {0} tracks •</span>
            <span> {'00:00:00'} </span>
          </div>
          <div className="pgl-buttton">
            <Button>
              <BiShuffle />
            </Button>
            <Button>
              <FaPlay />
            </Button>
            <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola name={'listen-later'} />
      </div>
    </div>
  )
}
