import { getLineItemsFromOrders } from '../lib/shopify.js'
import axios from 'axios'

const EXCLUDED_PICK_LIST_SKUS = new Set(['210476-988'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const { orderIds } = req.body

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).send('Invalid or missing "orderIds" array')
    }

    // Step 1: Get line items from orders
    const items = await getLineItemsFromOrders(orderIds)

    // Step 2: Group items by SKU and sum quantities
    const grouped = {}
    for (const item of items) {
      if (EXCLUDED_PICK_LIST_SKUS.has(String(item.sku || '').trim().toUpperCase())) {
        continue
      }

      if (!grouped[item.sku]) {
        grouped[item.sku] = { ...item, quantity: 0 }
      }
      grouped[item.sku].quantity += item.quantity
    }

    const pickList = Object.values(grouped)
    const skuList = pickList.map(p => p.sku)

    if (pickList.length === 0) {
      return res.json([])
    }

    // Step 3: Determine correct base URL
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    // Step 4: Fetch on-hand inventory using /api/pick-list
    const { data: inventory } = await axios.post(
      `${baseUrl}/api/pick-list`,
      { skus: skuList },
      { headers: { 'Content-Type': 'application/json' } }
    )

    // Step 5: Merge inventory data with pick list
    const enriched = pickList.map(item => {
      const match = inventory.find(i => i.sku === item.sku)
      return { ...item, onHand: match?.onHand ?? 0 }
    })

    res.json(enriched)
  } catch (err) {
    console.error('❌ Generate Pick List Error:', err.message)
    res.status(500).send('Pick list generation failed')
  }
}
