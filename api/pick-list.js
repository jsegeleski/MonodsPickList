import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const { skus } = req.body;

  if (!Array.isArray(skus) || skus.length === 0) {
    return res.status(400).send('Invalid or missing "skus" array');
  }

  // ✅ Function to fetch on_hand quantity by SKU
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

  try {
    const enriched = await Promise.all(
      skus.map(async (sku) => {
        const onHand = await fetchOnHandQuantity(sku);
        return { sku, onHand };
      })
    );

    res.status(200).json(enriched);
  } catch (err) {
    console.error('❌ Pick List Error:', err.message);
    res.status(500).send('Pick list lookup failed');
  }
}