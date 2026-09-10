import express from 'express'
import dotenv from 'dotenv'
import axios from 'axios'
import cors from 'cors'
import tagOrdersHandler from './api/tag-orders.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/tag-orders', tagOrdersHandler)

const PORT = 3001

async function shopifyFetch(query, variables = {}) {
  const response = await axios.post(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
    { query, variables },
    {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
}

// 🧠 NEW: Helper to fetch on_hand quantity by SKU
async function fetchOnHandQuantity(sku) {
  const response = await axios.post(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
    {
      query: `
      {
        inventoryItems(first: 1, query: "sku:${sku}") {
          edges {
            node {
              inventoryLevels(first: 5) {
                edges {
                  node {
                    location {
                      name
                    }
                    quantities(names: ["on_hand"]) {
                      name
                      quantity
                    }
                  }
                }
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
        'Content-Type': 'application/json',
      },
    }
  );

  const levels = response.data.data?.inventoryItems?.edges?.[0]?.node?.inventoryLevels?.edges || [];
  const match = levels.find(l => l.node.location.name === '129 Banff Avenue');
  const onHandObj = match?.node?.quantities?.find(q => q.name === 'on_hand');

  return onHandObj?.quantity ?? 0;
}

// ✅ Original: Fetch orders
app.get('/api/orders', async (req, res) => {
  try {
    let allOrders = []
    let nextUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/orders.json?status=open&fulfillment_status=unfulfilled&limit=50`

    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        }
      })

      allOrders = [...allOrders, ...response.data.orders]

      // Parse Link header to get next page (if exists)
      const linkHeader = response.headers['link']
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = match ? match[1] : null
      } else {
        nextUrl = null
      }
    }

    res.json(allOrders)
  } catch (error) {
    console.error('❌ Shopify API Error:', error.response?.status, error.response?.data || error.message)
    res.status(500).send('Error fetching orders')
  }
})

// ✅ NEW: Get onHand for each SKU in a list
app.post('/api/pick-list', async (req, res) => {
  try {
    const { skus } = req.body

    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).send('Invalid or missing "skus" array')
    }

    const enriched = await Promise.all(
      skus.map(async (sku) => {
        const onHand = await fetchOnHandQuantity(sku)
        return { sku, onHand }
      })
    )

    res.json(enriched)
  } catch (err) {
    console.error('❌ Pick List Error:', err.message)
    res.status(500).send('Pick list lookup failed')
  }
})

app.post('/api/product-titles', async (req, res) => {
  try {
    const { productIds } = req.body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).send('Invalid or missing "productIds" array')
    }

    const gidList = productIds.map(id => `gid://shopify/Product/${id}`)
    const query = `
      query GetProductTitles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            productType
          }
        }
      }
    `

    const shopifyRes = await shopifyFetch(query, { ids: gidList })

    const titleMap = {}
shopifyRes.data.nodes.forEach(node => {
  const id = node?.id?.split('/').pop()
  const title = node?.title || ''
  const productType = node?.productType || ''
  if (id) titleMap[id] = { title, productType }
})

    res.json(titleMap)
  } catch (err) {
    console.error('❌ /api/product-titles error:', JSON.stringify(err.response?.data || err.message, null, 2))
    res.status(500).send('Product title lookup failed')
  }
})

app.post('/api/images', async (req, res) => {
  try {
    const { variantIds } = req.body;

    if (!Array.isArray(variantIds) || variantIds.length === 0) {
      return res.status(400).send('Invalid or missing "variantIds" array');
    }

    const query = `
  query getImages($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        image {
          url
        }
        product {
          featuredImage {
            url
          }
        }
      }
    }
  }
`;

    const shopifyRes = await shopifyFetch(query, {
      ids: variantIds.map(id => `gid://shopify/ProductVariant/${id}`)
    });

    const imageMap = {};
    shopifyRes.data.nodes.forEach((node) => {
      const variantId = node?.id?.split('/').pop();
      const variantImage = node?.image?.url;
      const productImage = node?.product?.featuredImage?.url;
      imageMap[variantId] = variantImage || productImage || null;
    });

    res.json(imageMap);
  } catch (err) {
    console.error('❌ /api/images error:', JSON.stringify(err.response?.data || err.message, null, 2));
    res.status(500).send('Image lookup failed');
  }
});

// ✅ Still here for SKU-specific debugging
app.get('/api/debug-graphql', async (req, res) => {
  try {
    const sku = req.query.sku;

    if (!sku) {
      return res.status(400).send('Missing SKU parameter');
    }

    const query = `
    {
      inventoryItems(first: 1, query: "sku:${sku}") {
        edges {
          node {
            id
            sku
            inventoryLevels(first: 5) {
              edges {
                node {
                  location {
                    name
                  }
                  quantities(names: ["available", "on_hand"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
    `;

    const response = await axios.post(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
      { query },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('🧪 DEBUG GRAPHQL RESPONSE:', JSON.stringify(response.data, null, 2));

    const edges = response.data.data?.inventoryItems?.edges;
    if (!edges || edges.length === 0) {
      return res.status(404).send(`No inventory item found for SKU: ${sku}`);
    }

    const levels = edges[0].node.inventoryLevels.edges;
    const match = levels.find(l => l.node.location.name === '129 Banff Avenue');

    const quantityObj = match?.node?.quantities?.find(q => q.name === 'available');
    const available = quantityObj?.quantity ?? 0;

    res.json({
      sku,
      location: match?.node?.location?.name || 'Not found',
      available
    });

  } catch (err) {
    console.error('❌ GRAPHQL DEBUG ERROR:', JSON.stringify(err.response?.data || err.message, null, 2));
    res.status(500).send('GraphQL debug failed');
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
