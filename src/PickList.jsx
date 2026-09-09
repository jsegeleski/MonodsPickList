import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Page, Spinner, Text } from '@shopify/polaris'
import OrderDashboard from './OrderDashboard'

const EXCLUDED_SKUS = new Set(['210476-988'])
const FALLBACK_IMAGE = 'https://cdn.shopify.com/s/files/1/0654/3881/0355/files/24147_LMSP.jpg?v=1753225096'

function normalizeSku(sku) {
  return String(sku || '').trim().toUpperCase()
}

function formatNow() {
  return new Date().toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getItemKey(item) {
  const sku = normalizeSku(item.sku)
  if (sku) return `sku:${sku}`
  if (item.variant_id) return `variant:${item.variant_id}`
  return `product:${item.product_id || item.name}:${item.variant_title || ''}`
}

function buildPickItems(selectedOrders) {
  const groupedItems = new Map()

  selectedOrders.forEach((order) => {
    const lineItems = order.line_items || []
    lineItems.forEach((lineItem) => {
      const normalizedSku = normalizeSku(lineItem.sku)
      if (EXCLUDED_SKUS.has(normalizedSku)) return

      const key = getItemKey(lineItem)
      const quantity = Number(lineItem.quantity) || 0
      const existing = groupedItems.get(key)

      if (existing) {
        existing.quantity += quantity
        const orderEntry = existing.orders.find((entry) => entry.id === order.id)
        if (orderEntry) orderEntry.quantity += quantity
        else existing.orders.push({ id: order.id, name: order.name, quantity })
        return
      }

      groupedItems.set(key, {
        id: key,
        title: lineItem.name,
        attributes: lineItem.variant_title || '',
        quantity,
        sku: lineItem.sku || '',
        price: lineItem.price,
        vendor: lineItem.vendor,
        variant_id: lineItem.variant_id,
        product_id: lineItem.product_id,
        orders: [{ id: order.id, name: order.name, quantity }],
      })
    })
  })

  return [...groupedItems.values()]
}

async function postJson(url, body, signal) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) throw new Error(`${url} failed (${response.status})`)
  return response.json()
}

function PickList({ selectedOrders, setSelectedOrders }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [printing, setPrinting] = useState(false)
  const [generatedAt] = useState(formatNow)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPickList() {
      setLoading(true)
      setError('')

      const pickItems = buildPickItems(selectedOrders)
      if (pickItems.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      const skus = [...new Set(pickItems.map((item) => item.sku).filter(Boolean))]
      const variantIds = [...new Set(pickItems.map((item) => item.variant_id).filter(Boolean))]
      const productIds = [...new Set(pickItems.map((item) => item.product_id).filter(Boolean))]

      try {
        const [stockData, imageMap, titleMap] = await Promise.all([
          skus.length ? postJson('/api/pick-list', { skus }, controller.signal) : [],
          variantIds.length ? postJson('/api/images', { variantIds }, controller.signal) : {},
          productIds.length ? postJson('/api/product-titles', { productIds }, controller.signal) : {},
        ])
        const stockMap = Object.fromEntries(
          stockData.map(({ sku, onHand }) => [normalizeSku(sku), onHand]),
        )

        setItems(pickItems.map((item) => ({
          ...item,
          stock: stockMap[normalizeSku(item.sku)] ?? 0,
          image: imageMap[item.variant_id] || FALLBACK_IMAGE,
          productTitle: titleMap[item.product_id]?.title || item.title,
          productType: titleMap[item.product_id]?.productType || 'Uncategorized',
        })))
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          console.error('Failed to load pick list', requestError)
          setError('The pick list could not be generated. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (selectedOrders.length > 0) loadPickList()
    return () => controller.abort()
  }, [selectedOrders, reloadKey])

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

  if (selectedOrders.length === 0) {
    return <OrderDashboard onSelectOrders={setSelectedOrders} />
  }

  if (loading) {
    return (
      <Page>
        <div className="state-panel state-panel--large">
          <Spinner accessibilityLabel="Generating pick list" size="large" />
          <Text variant="headingMd" as="h1">Generating pick list…</Text>
          <Text as="p" tone="subdued">Combining products and checking inventory.</Text>
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
            <Button onClick={() => setSelectedOrders([])}>Back to orders</Button>
            <Button variant="primary" onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>
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
            <Text variant="headingXl" as="h1">Monod Sports pick list</Text>
            <p className="screen-description">Generated {generatedAt}</p>
            <div className="pick-list-summary">
              <span>{selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}</span>
              <span>{items.length} {items.length === 1 ? 'product' : 'products'}</span>
              <span>{totalUnits} units</span>
            </div>
          </div>
          <div className="button-row no-print">
            <Button onClick={() => setSelectedOrders([])}>Back</Button>
            <Button variant="primary" loading={printing} onClick={printList}>Print list</Button>
          </div>
        </header>

        {items.length === 0 ? (
          <Card>
            <div className="state-panel">
              <Text variant="headingMd" as="h2">Nothing to pick</Text>
              <Text as="p" tone="subdued">
                The selected orders only contain excluded products.
              </Text>
            </div>
          </Card>
        ) : Object.entries(groupedByType)
          .sort(([first], [second]) => first.localeCompare(second))
          .map(([productType, groupItems]) => (
            <section className="product-group" key={productType}>
              <div className="group-title">
                <Text variant="headingSm" as="h2">
                  {productType.split('>').pop().trim()}
                </Text>
                <span>{groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}</span>
              </div>
              <Card padding="0">
                <div className="product-list">
                  {groupItems.map((item) => (
                    <article className="product-card no-break" key={item.id}>
                      <div className="product-identity">
                        <div className="thumbnail-wrapper">
                          <img src={item.image} alt="" />
                        </div>
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
                            <span>{order.name}</span>
                            <strong>× {order.quantity}</strong>
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
