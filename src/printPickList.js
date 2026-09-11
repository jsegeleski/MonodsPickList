function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getSafeImageUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function renderProductRow(item) {
  const imageUrl = getSafeImageUrl(item.image)
  const orders = item.orders.map((order) => `
    <span class="print-order">
      <span>${escapeHtml(order.name)}</span>
      <strong>x ${escapeHtml(order.quantity)}</strong>
    </span>
  `).join('')

  return `
    <tr class="product-row">
      <td>
        <div class="print-product">
          <div class="print-image-frame">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : ''}
            <span class="print-image-placeholder">No image</span>
          </div>
          <div class="print-product-copy">
            ${item.vendor ? `<div class="print-vendor">${escapeHtml(item.vendor)}</div>` : ''}
            <div class="print-product-name">${escapeHtml(item.productTitle)}</div>
            ${item.attributes ? `<div class="print-variant">${escapeHtml(item.attributes)}</div>` : ''}
            <div class="print-sku">SKU ${escapeHtml(item.sku || 'not provided')}</div>
          </div>
        </div>
      </td>
      <td><div class="print-orders">${orders}</div></td>
      <td class="print-pick-cell">
        <div class="print-picked-box"><span class="write-line"></span><span>of <strong>${escapeHtml(item.quantity)}</strong></span></div>
      </td>
      <td class="print-stock-cell"><strong>${escapeHtml(item.stock)}</strong><span>on hand</span></td>
    </tr>
  `
}

export function createPickListPrintHtml({ items, selectedOrders, generatedAt }) {
  const sortedItems = [...items].sort((first, second) => (
    (first.productType || '').localeCompare(second.productType || '')
      || (first.productTitle || '').localeCompare(second.productTitle || '')
      || (first.attributes || '').localeCompare(second.attributes || '')
  ))
  let currentType = null
  const rows = sortedItems.map((item) => {
    const productType = item.productType || 'Uncategorized'
    const categoryRow = productType === currentType ? '' : `
      <tr class="category-row">
        <th colspan="4">${escapeHtml(productType.split('>').pop().trim())}</th>
      </tr>
    `
    currentType = productType
    return `${categoryRow}${renderProductRow(item)}`
  }).join('')
  const totalUnits = sortedItems.reduce((total, item) => total + item.quantity, 0)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Monod Sports Pick List - ${escapeHtml(generatedAt)}</title>
    <style>
      @page { size: letter portrait; margin: 0.4in; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; color: #202223; background: #fff; }
      body { font: 10pt/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
      .report { width: 100%; }
      .report-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 18pt;
        margin-bottom: 10pt;
        padding-bottom: 8pt;
        border-bottom: 2px solid #202223;
      }
      .brand { margin: 0 0 2pt; font-size: 8pt; font-weight: 750; letter-spacing: 0.12em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 19pt; line-height: 1.05; }
      .generated { margin-top: 3pt; color: #666; font-size: 8pt; }
      .summary { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4pt; }
      .summary span { padding: 3pt 6pt; border: 1px solid #bbb; border-radius: 999px; white-space: nowrap; font-size: 8pt; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      col.product { width: 47%; }
      col.orders { width: 27%; }
      col.picked { width: 16%; }
      col.stock { width: 10%; }
      thead { display: table-header-group; }
      thead th {
        padding: 4pt 5pt;
        border-bottom: 1px solid #777;
        color: #555;
        font-size: 7pt;
        letter-spacing: 0.08em;
        text-align: left;
        text-transform: uppercase;
      }
      thead th:nth-last-child(-n+2) { text-align: center; }
      tbody { break-inside: auto; }
      .category-row { break-after: avoid; page-break-after: avoid; }
      .category-row th {
        padding: 7pt 5pt 3pt;
        border-bottom: 1px solid #aaa;
        background: #eceeed;
        font-size: 8pt;
        letter-spacing: 0.08em;
        text-align: left;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .product-row { break-inside: avoid; page-break-inside: avoid; }
      .product-row td { padding: 5pt; border-bottom: 1px solid #ddd; vertical-align: middle; }
      .print-product { display: flex; min-width: 0; align-items: center; gap: 6pt; }
      .print-image-frame {
        position: relative;
        display: grid;
        width: 44pt;
        height: 44pt;
        flex: 0 0 44pt;
        overflow: hidden;
        place-items: center;
        border: 1px solid #ddd;
        border-radius: 4pt;
        background: #fff;
      }
      .print-image-frame img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: contain; background: #fff; }
      .print-image-placeholder { position: absolute; color: #999; font-size: 6pt; }
      .print-image-frame.image-error img { display: none; }
      .print-product-copy { min-width: 0; }
      .print-vendor { margin-bottom: 1pt; color: #666; font-size: 6.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .print-product-name { font-size: 9.5pt; font-weight: 750; overflow-wrap: anywhere; }
      .print-variant { margin-top: 1pt; font-size: 8pt; font-weight: 600; }
      .print-sku { margin-top: 1pt; color: #666; font-size: 7pt; }
      .print-orders { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2pt 6pt; }
      .print-order { display: flex; min-width: 0; justify-content: space-between; gap: 3pt; font-size: 7.5pt; }
      .print-order span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .print-order strong { flex: 0 0 auto; }
      .print-pick-cell, .print-stock-cell { text-align: center; }
      .print-picked-box { display: flex; align-items: baseline; justify-content: center; gap: 3pt; white-space: nowrap; }
      .write-line { display: inline-block; width: 25pt; height: 12pt; border-bottom: 1px solid #222; }
      .print-stock-cell strong, .print-stock-cell span { display: block; }
      .print-stock-cell strong { font-size: 11pt; }
      .print-stock-cell span { color: #666; font-size: 6.5pt; white-space: nowrap; }
      .empty { padding: 30pt; border: 1px solid #ddd; text-align: center; }
      .print-footer { margin-top: 8pt; color: #777; font-size: 7pt; text-align: right; }
      @media screen {
        body { padding: 0.4in; background: #e9e9e9; }
        .report { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0.4in; background: #fff; box-shadow: 0 4px 24px rgb(0 0 0 / 14%); }
      }
      @media print {
        body, .report { width: auto; min-height: 0; background: #fff; }
        .report { margin: 0; padding: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header class="report-header">
        <div>
          <div class="brand">Monod Sports</div>
          <h1>Pick list</h1>
          <div class="generated">Generated ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="summary">
          <span>${selectedOrders.length} ${selectedOrders.length === 1 ? 'order' : 'orders'}</span>
          <span>${sortedItems.length} ${sortedItems.length === 1 ? 'product' : 'products'}</span>
          <span>${totalUnits} units</span>
        </div>
      </header>
      ${sortedItems.length ? `
        <table>
          <colgroup><col class="product"><col class="orders"><col class="picked"><col class="stock"></colgroup>
          <thead><tr><th>Product</th><th>Orders</th><th>Picked</th><th>Stock</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<div class="empty">The selected orders contain no products to pick.</div>'}
      <div class="print-footer">Monod Sports pick list</div>
    </main>
  </body>
</html>`
}

export async function waitForPrintDocument(printWindow, timeoutMs = 8000) {
  const images = [...printWindow.document.images]
  const imagePromises = images.map((image) => new Promise((resolve) => {
    const finish = () => {
      if (!image.naturalWidth) image.closest('.print-image-frame')?.classList.add('image-error')
      resolve()
    }
    if (image.complete) finish()
    else {
      image.addEventListener('load', finish, { once: true })
      image.addEventListener('error', finish, { once: true })
    }
  }))

  await Promise.race([
    Promise.all(imagePromises),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
  if (printWindow.document.fonts?.ready) {
    await Promise.race([
      printWindow.document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  }
  await new Promise((resolve) => printWindow.requestAnimationFrame(
    () => printWindow.requestAnimationFrame(resolve),
  ))
}
