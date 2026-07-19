import DochiRoom from './components/DochiRoom'
import { useDjDochiFlow } from './hooks/useDjDochiFlow'

function App() {
  const flow = useDjDochiFlow()

  return <DochiRoom flow={flow} />
}

export default App
