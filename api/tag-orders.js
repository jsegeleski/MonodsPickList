import axios from 'axios'

const STATUS_CONFIG = {
  PLP: { timestampKey: 'pick_list_printed_at' },
  'PLP-PICKED': { timestampKey: 'pick_list_picked_at' },
  'PLP-PARTIAL': { timestampKey: 'pick_list_partial_at' },
}

const MOBILE_STATUS_TAGS = new Set(['PLP-PICKED', 'PLP-PARTIAL'])
const MOBILE_STATUS_KEYS = new Set([
  'pick_list_picked_at',
  'pick_list_partial_at',
  'pick_list_status',
  'pick_list_summary',
])

function normalizeTags(tags) {
  return String(tags || '')
    .split(',')
    .map((existingTag) => existingTag.trim())
    .filter(Boolean)
}

function addAttribute(attributes, name, value) {
  const nextAttributes = attributes.filter((attribute) => attribute?.name !== name)
  nextAttributes.push({ name, value })
  return nextAttributes
}

function validateOrderResults(orderResults) {
  if (!Array.isArray(orderResults) || orderResults.length === 0) return null

  const normalized = orderResults.map((result) => ({
    id: result?.id,
    status: result?.status,
    summary: typeof result?.summary === 'string' ? result.summary.trim().slice(0, 4000) : '',
  }))
  const valid = normalized.every((result) => (
    result.id
      && ['picked', 'partial'].includes(result.status)
      && result.summary
  ))

  return valid ? normalized : null
}

async function updateOrder({ id, tag, summary }) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN
  const headers = {
    'X-Shopify-Access-Token': token,
    'Content-Type': 'application/json',
  }
  const getOrder = await axios.get(
    `https://${domain}/admin/api/2024-01/orders/${id}.json`,
    { headers },
  )
  const order = getOrder.data.order
  let tags = normalizeTags(order.tags)
  let noteAttributes = Array.isArray(order.note_attributes) ? [...order.note_attributes] : []
  const statusTimestamp = new Date().toISOString()

  if (MOBILE_STATUS_TAGS.has(tag)) {
    tags = tags.filter((existingTag) => !MOBILE_STATUS_TAGS.has(existingTag))
    noteAttributes = noteAttributes.filter(
      (attribute) => !MOBILE_STATUS_KEYS.has(attribute?.name),
    )
    noteAttributes = addAttribute(
      noteAttributes,
      'pick_list_status',
      tag === 'PLP-PICKED' ? 'Picked' : 'Partially picked',
    )
    noteAttributes = addAttribute(noteAttributes, 'pick_list_summary', summary)
  }

  if (!tags.includes(tag)) tags.push(tag)
  noteAttributes = addAttribute(noteAttributes, STATUS_CONFIG[tag].timestampKey, statusTimestamp)

  await axios.put(
    `https://${domain}/admin/api/2024-01/orders/${id}.json`,
    {
      order: {
        id,
        tags: tags.join(', '),
        note_attributes: noteAttributes,
      },
    },
    { headers },
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { orderIds, tag, orderResults } = req.body || {}
  const mobileResults = validateOrderResults(orderResults)
  let updates

  if (orderResults !== undefined && !mobileResults) {
    return res.status(400).json({ error: 'Invalid orderResults' })
  }

  if (mobileResults) {
    updates = mobileResults.map((result) => ({
      id: result.id,
      tag: result.status === 'picked' ? 'PLP-PICKED' : 'PLP-PARTIAL',
      summary: result.summary,
    }))
  } else {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing orderIds' })
    }
    if (!STATUS_CONFIG[tag]) {
      return res.status(400).json({ error: 'Unsupported order status tag' })
    }
    updates = [...new Set(orderIds)].map((id) => ({ id, tag, summary: '' }))
  }

  try {
    for (const update of updates) {
      await updateOrder(update)
    }
    return res.status(200).json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('❌ Shopify API Error:', error.response?.data || error.message)
    return res.status(500).json({ error: 'Failed to update order picking status' })
  }
}
