// src/OrderDashboard.jsx
import { useEffect, useState } from 'react'
import { Page, Card, ResourceList, ResourceItem, Text, Button, Checkbox } from '@shopify/polaris'

function OrderDashboard({ onSelectOrders }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    fetch('http://localhost:3001/api/orders')
      .then((res) => res.json())
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load orders', err)
        setLoading(false)
      })
  }, [])

  const toggleOrder = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectedOrders = orders.filter((order) => selectedIds.includes(order.id))

  return (
    <Page>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Text variant="headingLg" as="h2">Select Orders</Text>
        <Button
          primary
          onClick={() => onSelectOrders(selectedOrders)}
          disabled={selectedIds.length === 0}
        >
          Create Pick List
        </Button>
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
  <tr style={{ borderBottom: '1px solid #ccc' }}>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>
      <span
        style={{
          textDecoration: 'underline',
          cursor: 'pointer',
          fontSize: '0.65rem',
          color: 'inherit' // uses default text color
        }}
        onClick={() => {
          const allSelected = selectedIds.length === orders.length;
          setSelectedIds(allSelected ? [] : orders.map(order => order.id));
        }}
      >
        {selectedIds.length === orders.length ? 'Deselect All' : 'Select All'}
      </span>
    </th>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Order</th>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Customer</th>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Total</th>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Payment</th>
    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
  </tr>
</thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <Checkbox
                    checked={selectedIds.includes(order.id)}
                    onChange={() => toggleOrder(order.id)}
                  />
                </td>
                <td style={{ padding: '0.75rem' }}>
  <a
    href={`https://admin.shopify.com/store/monodsports-1394/orders/${order.id}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{ textDecoration: 'underline', color: '#333' }}
  >
    {order.name}
  </a>
</td>
                <td style={{ padding: '0.75rem' }}>{new Date(order.created_at).toISOString().split('T')[0]}</td>
                <td style={{ padding: '0.75rem' }}>
                  {order.customer?.first_name} {order.customer?.last_name}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  ${parseFloat(order.total_price).toFixed(2)}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {order.financial_status.charAt(0).toUpperCase() + order.financial_status.slice(1)}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {order.fulfillment_status ? (
                    <span style={{
                      background: '#ffe58f',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '0.85rem'
                    }}>
                      {order.fulfillment_status.charAt(0).toUpperCase() + order.fulfillment_status.slice(1)}
                    </span>
                  ) : 'Unfulfilled'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  )
}

export default OrderDashboard