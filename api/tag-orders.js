// /api/tag-orders.js
import axios from 'axios';

const STATUS_CONFIG = {
  PLP: { timestampKey: 'pick_list_printed_at' },
  'PLP-PICKED': { timestampKey: 'pick_list_picked_at' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderIds, tag } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: 'Invalid or missing orderIds' });
  }
  if (!tag || typeof tag !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing tag' });
  }

  const statusConfig = STATUS_CONFIG[tag];
  if (!statusConfig) {
    return res.status(400).json({ error: 'Unsupported order status tag' });
  }

  try {
    for (const id of orderIds) {
      // 1) Get current order
      const getOrder = await axios({
        method: 'get',
        url: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${id}.json`,
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      const order = getOrder.data.order;

      // Merge tags
      const existingTags = order.tags || '';
      const tagsArray = existingTags ? existingTags.split(',').map(t => t.trim()).filter(Boolean) : [];
      if (!tagsArray.includes(tag)) tagsArray.push(tag);

      // Record a separate timestamp for printing and completed mobile picking.
      const statusTimestamp = new Date().toISOString();

      const noteAttrs = Array.isArray(order.note_attributes) ? [...order.note_attributes] : [];
      const idx = noteAttrs.findIndex(a => a?.name === statusConfig.timestampKey);
      if (idx >= 0) {
        noteAttrs[idx] = { name: statusConfig.timestampKey, value: statusTimestamp };
      } else {
        noteAttrs.push({ name: statusConfig.timestampKey, value: statusTimestamp });
      }

      // 2) Update order with new tags + note_attributes
      await axios({
        method: 'put',
        url: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${id}.json`,
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
        data: {
          order: {
            id,
            tags: tagsArray.join(', '),
            note_attributes: noteAttrs,
          },
        },
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Shopify API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to tag orders' });
  }
}
