import { useMemo, useState } from 'react'
import { Button, Card, Page, Text } from '@shopify/polaris'
import FunnyLoading from './FunnyLoading'
import usePickListData from './usePickListData'

function formatNow() {
  return new Date().toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PickList({ selectedOrders, onBack, onHome }) {
  const { items, loading, error, retry } = usePickListData(selectedOrders)
  const [printing, setPrinting] = useState(false)
  const [generatedAt] = useState(formatNow)

  const groupedByType = useMemo(() => items.reduce((groups, item) => {
    const type = item.productType || 'Uncategorized'
    if (!groups[type]) groups[type] = []
    groups[type].push(item)
    return groups
  }, {}), [items])

  const totalUnits = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  )

  async function printList() {
    setPrinting(true)
    try {
      const response = await fetch('/api/tag-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: [...new Set(selectedOrders.map((order) => order.id))],
          tag: 'PLP',
        }),
      })
      if (!response.ok) throw new Error(`Tagging orders failed (${response.status})`)
    } catch (tagError) {
      console.error('Failed to tag orders as printed', tagError)
    } finally {
      setPrinting(false)
      window.print()
    }
  }

  if (loading) {
    return (
      <Page>
        <div className="state-panel state-panel--large">
          <FunnyLoading title="Building your printable list…" />
        </div>
      </Page>
    )
  }

  if (error) {
    return (
      <Page>
        <div className="state-panel state-panel--large state-panel--error" role="alert">
          <Text variant="headingMd" as="h1">Unable to generate the pick list</Text>
          <Text as="p">{error}</Text>
          <div className="button-row">
            <Button onClick={onBack}>Back to orders</Button>
            <Button variant="primary" onClick={retry}>Try again</Button>
          </div>
        </div>
      </Page>
    )
  }

  return (
    <div className="print-content">
      <Page>
        <header className="screen-header pick-list-header">
          <div>
            <button className="text-back no-print" type="button" onClick={onHome}>← Picking options</button>
            <Text variant="headingXl" as="h1">Monod Sports pick list</Text>
            <p className="screen-description">Generated {generatedAt}</p>
            <div className="pick-list-summary">
              <span>{selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}</span>
              <span>{items.length} {items.length === 1 ? 'product' : 'products'}</span>
              <span>{totalUnits} units</span>
            </div>
          </div>
          <div className="button-row no-print">
            <Button onClick={onBack}>Back</Button>
            <Button variant="primary" loading={printing} onClick={printList}>Print list</Button>
          </div>
        </header>

        {items.length === 0 ? (
          <Card>
            <div className="state-panel">
              <Text variant="headingMd" as="h2">Nothing to pick</Text>
              <Text as="p" tone="subdued">The selected orders only contain excluded products.</Text>
            </div>
          </Card>
        ) : Object.entries(groupedByType)
          .sort(([first], [second]) => first.localeCompare(second))
          .map(([productType, groupItems]) => (
            <section className="product-group" key={productType}>
              <div className="group-title">
                <Text variant="headingSm" as="h2">{productType.split('>').pop().trim()}</Text>
                <span>{groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}</span>
              </div>
              <Card padding="0">
                <div className="product-list">
                  {groupItems.map((item) => (
                    <article className="product-card no-break" key={item.id}>
                      <div className="product-identity">
                        <div className="thumbnail-wrapper"><img src={item.image} alt="" /></div>
                        <div className="product-copy">
                          <div className="product-vendor">{item.vendor}</div>
                          <div className="product-title">{item.productTitle}</div>
                          {item.attributes ? <div className="product-subtext">{item.attributes}</div> : null}
                          <div className="product-subtext">SKU: {item.sku || 'No SKU'}</div>
                        </div>
                      </div>

                      <div className="order-breakdown">
                        <div className="detail-label">Orders</div>
                        {item.orders.map((order) => (
                          <div className="order-quantity" key={order.id}>
                            <span>{order.name}</span><strong>× {order.quantity}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="pick-quantity">
                        <div className="picked-bubble">
                          <span>Picked</span>
                          <span className="picked-line" aria-hidden="true">&nbsp;</span>
                          <span>of <strong>{item.quantity}</strong></span>
                        </div>
                        <div className="stock-count">{item.stock} on hand</div>
                      </div>
                    </article>
                  ))}
                </div>
              </Card>
            </section>
          ))}
      </Page>
    </div>
  )
}

export default PickList
