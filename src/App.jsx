import { useEffect, useState } from 'react'
import MobilePicker from './MobilePicker'
import OrderDashboard from './OrderDashboard'
import PickList from './PickList'
import WorkflowHome from './WorkflowHome'

const SESSION_KEY = 'monods-active-pick-session'

function readActiveSession() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || '{}')
    return {
      workflow: ['print', 'mobile'].includes(session.workflow) ? session.workflow : null,
      selectedOrders: Array.isArray(session.selectedOrders) ? session.selectedOrders : [],
    }
  } catch {
    return { workflow: null, selectedOrders: [] }
  }
}

function App() {
  const [initialSession] = useState(readActiveSession)
  const [workflow, setWorkflow] = useState(initialSession.workflow)
  const [selectedOrders, setSelectedOrders] = useState(initialSession.selectedOrders)

  useEffect(() => {
    if (!workflow) {
      window.sessionStorage.removeItem(SESSION_KEY)
      return
    }

    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ workflow, selectedOrders }))
  }, [workflow, selectedOrders])

  function returnHome() {
    setSelectedOrders([])
    setWorkflow(null)
  }

  if (!workflow) {
    return <WorkflowHome onChoose={setWorkflow} />
  }

  if (selectedOrders.length === 0) {
    return (
      <OrderDashboard
        workflow={workflow}
        onBack={returnHome}
        onSelectOrders={setSelectedOrders}
      />
    )
  }

  if (workflow === 'mobile') {
    return (
      <MobilePicker
        selectedOrders={selectedOrders}
        onBack={() => setSelectedOrders([])}
        onHome={returnHome}
      />
    )
  }

  return (
    <PickList
      selectedOrders={selectedOrders}
      onBack={() => setSelectedOrders([])}
      onHome={returnHome}
    />
  )
}

export default App
