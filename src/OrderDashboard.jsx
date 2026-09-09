import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Checkbox, Page, Spinner, Text } from '@shopify/polaris'

function formatPrintedAt(iso) {
  if (!iso) return 'Previously printed'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Previously printed'

  return `Printed ${date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function getPrintedAtFromNotes(order) {
  return order?.note_attributes?.find(
    (attribute) => attribute?.name === 'pick_list_printed_at',
  )?.value
}

function formatStatus(status, fallback) {
  if (!status) return fallback
  return status.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase())
}

function formatOrderDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function hasTag(order, expectedTag) {
  const tags = Array.isArray(order.tags) ? order.tags : String(order.tags || '').split(',')
  return tags.some((tag) => tag.trim() === expectedTag)
}

function OrderDashboard({ workflow = 'print', onBack, onSelectOrders }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const lastSelectedIndex = useRef(null)
  const shiftKeyPressed = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOrders() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/orders', { signal: controller.signal })
        if (!response.ok) throw new Error(`Orders request failed (${response.status})`)

        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('The orders response was not valid')
        setOrders(data)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          console.error('Failed to load orders', requestError)
          setError('Orders could not be loaded. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadOrders()
    return () => controller.abort()
  }, [reloadKey])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIdSet.has(order.id)),
    [orders, selectedIdSet],
  )

  const updateSelection = useCallback((index, checked, useRange) => {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)
      const hasAnchor = lastSelectedIndex.current !== null

      if (useRange && hasAnchor) {
        const start = Math.min(lastSelectedIndex.current, index)
        const end = Math.max(lastSelectedIndex.current, index)
        orders.slice(start, end + 1).forEach((order) => {
          if (checked) nextIds.add(order.id)
          else nextIds.delete(order.id)
        })
      } else if (checked) {
        nextIds.add(orders[index].id)
      } else {
        nextIds.delete(orders[index].id)
      }

      return [...nextIds]
    })

    lastSelectedIndex.current = index
  }, [orders])

  const allSelected = orders.length > 0 && selectedIds.length === orders.length
  const isMobileWorkflow = workflow === 'mobile'

  return (
    <Page>
      <main className={`orders-page ${isMobileWorkflow ? 'orders-page--mobile' : ''}`}>
        <header className="screen-header">
          <div>
            {onBack ? <button className="text-back" type="button" onClick={onBack}>← Picking options</button> : null}
            <Text variant="headingXl" as="h1">
              {isMobileWorkflow ? 'Choose orders to pick' : 'Choose orders to print'}
            </Text>
            <p className="screen-description">
              {isMobileWorkflow
                ? 'Select the open orders you want to work through on this device.'
                : 'Select open orders below. Shift-click a checkbox to select a range.'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => onSelectOrders(selectedOrders)}
            disabled={selectedIds.length === 0}
          >
            {isMobileWorkflow ? 'Start picking' : 'Create pick list'}
            {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
        </header>

        <Card>
          <div className="selection-toolbar">
            <div className="selection-actions">
              <Button
                variant="plain"
                onClick={() => {
                  setSelectedIds(allSelected ? [] : orders.map((order) => order.id))
                  lastSelectedIndex.current = null
                }}
                disabled={loading || orders.length === 0}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </Button>
              {selectedIds.length > 0 && !allSelected ? (
                <Button variant="plain" onClick={() => setSelectedIds([])}>Clear selection</Button>
              ) : null}
            </div>
            <span className="selection-count" aria-live="polite">
              {selectedIds.length} of {orders.length} selected
            </span>
          </div>

          {loading ? (
            <div className="state-panel">
              <Spinner accessibilityLabel="Loading orders" size="small" />
              <Text as="p">Loading open orders…</Text>
            </div>
          ) : error ? (
            <div className="state-panel state-panel--error" role="alert">
              <Text as="p">{error}</Text>
              <Button onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="state-panel">
              <Text variant="headingMd" as="h2">No open orders</Text>
              <Text as="p" tone="subdued">There are no unfulfilled orders to pick right now.</Text>
            </div>
          ) : (
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th className="checkbox-column"><span className="visually-hidden">Select</span></th>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Pick list</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const isSelected = selectedIdSet.has(order.id)
                    const customerName = [order.customer?.first_name, order.customer?.last_name]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <tr key={order.id} className={isSelected ? 'is-selected' : undefined}>
                        <td
                          className="checkbox-column"
                          onClickCapture={(event) => { shiftKeyPressed.current = event.shiftKey }}
                        >
                          <Checkbox
                            label={`Select order ${order.name}`}
                            labelHidden
                            checked={isSelected}
                            onChange={(checked) => {
                              updateSelection(index, checked, shiftKeyPressed.current)
                              shiftKeyPressed.current = false
                            }}
                          />
                        </td>
                        <td>
                          <a
                            className="order-link"
                            href={`https://admin.shopify.com/store/monodsports-1394/orders/${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {order.name}
                          </a>
                        </td>
                        <td>{formatOrderDate(order.created_at)}</td>
                        <td>{customerName || 'Guest'}</td>
                        <td>${Number(order.total_price || 0).toFixed(2)}</td>
                        <td>{formatStatus(order.financial_status, 'Unknown')}</td>
                        <td>
                          <Badge tone={order.fulfillment_status ? 'attention' : 'warning'}>
                            {formatStatus(order.fulfillment_status, 'Unfulfilled')}
                          </Badge>
                        </td>
                        <td>
                          {hasTag(order, 'PLP') ? (
                            <Badge tone="success">
                              {formatPrintedAt(getPrintedAtFromNotes(order))}
                            </Badge>
                          ) : <span className="muted-text">Not printed</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </Page>
  )
}

export default OrderDashboard
