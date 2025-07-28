import { useEffect, useState } from 'react'
import OrderDashboard from './OrderDashboard'
import {
  Page,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Button,
} from '@shopify/polaris'

function PickList({ selectedOrders, setSelectedOrders }) {
  const [items, setItems] = useState([])

  useEffect(() => {
  const fetchData = async () => {
    const enriched = selectedOrders.flatMap(order =>
      order.line_items.map((item, idx) => ({
  id: `${order.id}-${idx}`,
  title: item.name,
  attributes: `${item.variant_title || ''}`,
  quantity: item.quantity,
  sku: item.sku,
  price: item.price,
  vendor: item.vendor,
  order: order.name,
  stock: null,
  variant_id: item.variant_id,
  product_id: item.product_id, // ✅ ADD THIS
  image: null,
}))
    )

    // Get stock
    const skus = enriched.map(item => item.sku)
    const stockRes = await fetch('http://localhost:3001/api/pick-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus })
    })
    const stockData = await stockRes.json()
    const stockMap = Object.fromEntries(stockData.map(({ sku, onHand }) => [sku, onHand]))

    // Get images
    const variantIds = enriched.map(item => item.variant_id)
    const imageRes = await fetch('http://localhost:3001/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantIds })
    })
    const imageMap = await imageRes.json()
    
    // Get product titles
const productIds = [...new Set(enriched.map(item => item.product_id))]
const titleRes = await fetch('http://localhost:3001/api/product-titles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productIds })
})
const titleMap = await titleRes.json() // { [product_id]: 'Parent Title' }



    // Final merge
const enrichedWithData = enriched.map(item => ({
  ...item,
  stock: stockMap[item.sku] ?? 0,
  image: imageMap[item.variant_id] || 'https://cdn.shopify.com/s/files/1/0654/3881/0355/files/24147_LMSP.jpg?v=1753225096',
  productTitle: titleMap[item.product_id]?.title || item.title, // ⬅️ already correct
  productType: titleMap[item.product_id]?.productType || 'Uncategorized' // ✅ add this
}))

    setItems(enrichedWithData)
  }

  if (selectedOrders.length > 0) {
    fetchData()
  }
}, [selectedOrders])

  const groupedByType = items.reduce((acc, item) => {
  const type = item.productType || 'Uncategorized'
  if (!acc[type]) acc[type] = []
  acc[type].push(item)
  return acc
}, {})

  if (selectedOrders.length === 0) {
    return <OrderDashboard onSelectOrders={setSelectedOrders} />
  }

  return (
  <div className="print-content">
    <Page>
      {/* Header Row: Title + Print Button */}
      <div style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: '1.5rem' 
}}>
  <Text variant="headingXl" as="h2">Monods Pick List</Text>
  
  <div style={{ display: 'flex', gap: '1rem' }}>
    <Button onClick={() => setSelectedOrders([])}>Back</Button>
    <Button onClick={() => window.print()}>Print List</Button>
  </div>
</div>

      {/* Card with Pick Items */}
      {Object.entries(groupedByType)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([productType, groupItems]) => (
  <Card key={productType} sectioned>
    <Text variant="headingMd" fontWeight="bold">
  {productType.split('>').pop().trim()}
</Text>
    <ResourceList
      resourceName={{ singular: 'product', plural: 'products' }}
      items={groupItems}
      renderItem={(item) => {
        const {
          id,
          title,
          vendor,
          sku,
          attributes,
          price,
          order,
          stock,
          quantity,
          image,
          productTitle
        } = item

        return (
          <div className="no-break">
            <ResourceItem id={id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
                {/* Column 1 */}
                <div style={{ flex: 2.5, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <Thumbnail source={image} alt={title} size="large" />
                  <div>
                    <Text size="subdued">{vendor}</Text>
                    <Text fontWeight="bold" as="h3" variant="headingMd">{productTitle}</Text>
                    <Text>{attributes}</Text>
                  </div>
                </div>

                {/* Column 2 */}
                <div style={{ flex: 1 }}>
                  <Text>SKU: {sku}</Text>
                  <Text>Price: ${price}</Text>
                  <Text>Order #: {order}</Text>
                </div>

                {/* Column 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div className="picked-bubble">
                    Picked <span style={{ display: 'inline-block', minWidth: '40px', borderBottom: '1px solid black', height: '1rem' }}>&nbsp;</span> of <strong>{quantity}</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', marginTop: '6px' }}>
                    {stock} on hand
                  </div>
                </div>
              </div>
            </ResourceItem>
          </div>
        )
      }}
    />
  </Card>
))}
    </Page>
  </div>
)
}

export default PickList