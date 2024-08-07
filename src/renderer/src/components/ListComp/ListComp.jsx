import './ListComp.scss'
import { useEffect } from 'react'
import { Cola } from './../../Cola'
import { useAppContext } from '../../Contexts/AppContext'
import { PlaylistActions } from './../../PlaylistActions'

function ListComp({ dataKey, fetchFunction, listName }) {
  const { [dataKey]: list, [fetchFunction]: fetchList } = useAppContext()

  useEffect(() => {
    if (fetchList) {
      fetchList()
    }
  }, [])

  return (
    <div className="default-class">
      <PlaylistActions name={listName} />
      <h1>{listName}</h1>
      <Cola list={list} name={listName} />
    </div>
  )
}

export default ListComp
