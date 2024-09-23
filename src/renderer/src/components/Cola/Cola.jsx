/* eslint-disable react/prop-types */

import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'

export function Cola({ list, name, filePath = null, actions }) {
  return (
    <div className="Cola">
      {list && list.length > 0 ? (
        <ul>
          {list.map((file, index) => (
            <SongItem
              key={index}
              file={file}
              index={index}
              cola={list}
              name={name}
              filePath={filePath}
              padreActions={actions}
            />
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}
