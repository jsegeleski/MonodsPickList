import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

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

  try {
    const response = await axios.post(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-04/graphql.json`,
      {
        query,
        variables: {
          ids: variantIds.map(id => `gid://shopify/ProductVariant/${id}`),
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const imageMap = {};
    const nodes = response.data?.data?.nodes || [];

    nodes.forEach((node) => {
      const variantId = node?.id?.split('/').pop();
      const variantImage = node?.image?.url;
      const productImage = node?.product?.featuredImage?.url;
      imageMap[variantId] = variantImage || productImage || null;
    });

    res.status(200).json(imageMap);
  } catch (err) {
    console.error('❌ /api/images error:', JSON.stringify(err.response?.data || err.message, null, 2));
    res.status(500).send('Image lookup failed');
  }
}