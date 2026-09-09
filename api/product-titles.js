import axios from 'axios'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const { productIds } = req.body

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).send('Missing or invalid productIds')
  }

  try {
    const query = `
      query getProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            productType
          }
        }
      }
    `

    const globalIds = productIds.map(
      (id) => `gid://shopify/Product/${id}`
    )

    const response = await axios.post(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
      {
        query,
        variables: { ids: globalIds },
      },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const result = {}
    for (const product of response.data.data.nodes) {
      if (product) {
        const numericId = product.id.split('/').pop()
        result[numericId] = {
          title: product.title,
          productType: product.productType,
        }
      }
    }

    res.json(result)
  } catch (err) {
    console.error('❌ Error in /api/product-titles:', err.message)
    res.status(500).send('Error fetching product titles')
  }
}