import axios from 'axios'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const domain = process.env.SHOPIFY_STORE_DOMAIN
    const token = process.env.SHOPIFY_ADMIN_API_TOKEN

    let allOrders = []
    let nextUrl = `https://${domain}/admin/api/2023-04/orders.json?status=open&fulfillment_status=unfulfilled&limit=50`

    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      })

      allOrders = [...allOrders, ...response.data.orders]

      const linkHeader = response.headers['link']
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = match ? match[1] : null
      } else {
        nextUrl = null
      }
    }

    res.status(200).json(allOrders)
  } catch (error) {
    console.error('❌ Shopify API Error:', error.response?.status, error.response?.data || error.message)
    res.status(500).send('Error fetching orders')
  }
}