import { useEffect, useState } from 'react'

const EXCLUDED_SKUS = new Set(['210476-988'])
const FALLBACK_IMAGE = 'https://cdn.shopify.com/s/files/1/0654/3881/0355/files/24147_LMSP.jpg?v=1753225096'

function normalizeSku(sku) {
  return String(sku || '').trim().toUpperCase()
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
      if (EXCLUDED_SKUS.has(normalizeSku(lineItem.sku))) return

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

export default function usePickListData(selectedOrders) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPickList() {
      const loadingStartedAt = Date.now()
      setLoading(true)
      setError('')

      async function finishLoading() {
        const remainingDelay = Math.max(0, 4000 - (Date.now() - loadingStartedAt))
        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay))
        }
        if (!controller.signal.aborted) setLoading(false)
      }

      const pickItems = buildPickItems(selectedOrders)
      if (pickItems.length === 0) {
        setItems([])
        await finishLoading()
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
        await finishLoading()
      }
    }

    if (selectedOrders.length > 0) loadPickList()
    return () => controller.abort()
  }, [selectedOrders, reloadKey])

  return {
    items,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  }
}
