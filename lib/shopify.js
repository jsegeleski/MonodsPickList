import axios from 'axios'

const EXCLUDED_PICK_LIST_SKUS = new Set(['210476-988'])

export async function shopifyFetch(query, variables = {}) {
  const response = await axios.post(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
    { query, variables },
    {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
        'Content-Type': 'application/json'
      }
    }
  )
  return response.data
}

// ✅ Used by /api/product-titles
export async function getProductTitlesByIds(productIds) {
  const query = `
    query getTitles($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          productType
        }
      }
    }
  `

  const variables = {
    ids: productIds.map(id => `gid://shopify/Product/${id}`)
  }

  const res = await shopifyFetch(query, variables)

  const titleMap = {}
  for (const product of res.data.nodes) {
    if (product) {
      const id = product.id.split('/').pop()
      titleMap[id] = {
        title: product.title,
        productType: product.productType
      }
    }
  }

  return titleMap
}

// ✅ Used by /api/images
export async function getImagesByVariantIds(variantIds) {
  const query = `
    query getVariantImages($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          image {
            originalSrc
            altText
          }
        }
      }
    }
  `

  const variables = {
    ids: variantIds.map(id => `gid://shopify/ProductVariant/${id}`)
  }

  const res = await shopifyFetch(query, variables)

  const imageMap = {}
  for (const variant of res.data.nodes) {
    if (variant && variant.id) {
      const id = variant.id.split('/').pop()
      imageMap[id] = variant.image?.originalSrc || null
    }
  }

  return imageMap
}

// ✅ Optional: still used by orders logic
export async function getLineItemsFromOrders(orderIds) {
  const results = []

  for (const id of orderIds) {
    const response = await axios.post(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
      {
        query: `
          query {
            order(id: "gid://shopify/Order/${id}") {
              lineItems(first: 50) {
                edges {
                  node {
                    name
                    sku
                    quantity
                  }
                }
              }
            }
          }
        `
      },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    )

    const lineItems = response.data.data?.order?.lineItems?.edges || []

    for (const edge of lineItems) {
      const { name, sku, quantity } = edge.node
      const normalizedSku = String(sku || '').trim().toUpperCase()
      if (sku && !EXCLUDED_PICK_LIST_SKUS.has(normalizedSku)) {
        results.push({ title: name, sku, quantity })
      }
    }
  }

  return results
}
