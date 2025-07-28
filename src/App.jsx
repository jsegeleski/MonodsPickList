import { useState } from 'react'
import OrderDashboard from './OrderDashboard'
import PickList from './PickList'

function App() {
  const [selectedOrders, setSelectedOrders] = useState([])

  return selectedOrders.length === 0 ? (
    <OrderDashboard onSelectOrders={setSelectedOrders} />
  ) : (
    <PickList
      selectedOrders={selectedOrders}
      setSelectedOrders={setSelectedOrders}
    />
  )
}

export default App