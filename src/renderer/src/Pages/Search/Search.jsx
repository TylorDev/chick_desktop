import { useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'
import { useAppContext } from '../../Contexts/AppContext'

function Search() {
  const { results, searchSongs } = useAppContext()
  const [query, setQuery] = useState('')

  const handleSearch = () => {
    searchSongs(query)
    // Aquí iría la lógica de búsqueda
  }

  return (
    <div className="default-class">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ingresa tu búsqueda"
      />
      <button onClick={handleSearch}>Buscar</button>
      <h1>resultados!</h1>
      <Cola list={results} name={'resultados'} />
    </div>
  )
}
export default Search
