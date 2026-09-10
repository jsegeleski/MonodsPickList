import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Page, Text } from '@shopify/polaris'
import FunnyLoading from './FunnyLoading'
import usePickListData from './usePickListData'

function readProgress(storageKey) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    if (Array.isArray(stored)) {
      return Object.fromEntries(stored.map((id) => [id, Number.MAX_SAFE_INTEGER]))
    }
    return stored && typeof stored === 'object' ? stored : {}
  } catch {
    return {}
  }
}

function readSkippedItems(storageKey) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

function formatItemLabel(item) {
  const details = [item.productTitle, item.attributes, item.sku ? `SKU ${item.sku}` : '']
    .filter(Boolean)
  return details.join(' — ')
}

function MobilePicker({ selectedOrders, onBack, onHome }) {
  const { items, loading, error, retry } = usePickListData(selectedOrders)
  const orderedItems = useMemo(() => [...items].sort((first, second) => (
    (first.productType || '').localeCompare(second.productType || '')
      || (first.productTitle || '').localeCompare(second.productTitle || '')
      || (first.attributes || '').localeCompare(second.attributes || '')
  )), [items])
  const storageKey = useMemo(() => (
    `monods-mobile-pick:${selectedOrders.map((order) => order.id).sort().join('-')}`
  ), [selectedOrders])
  const skippedStorageKey = `${storageKey}:skipped`
  const [pickedQuantities, setPickedQuantities] = useState(() => readProgress(storageKey))
  const [skippedItemIds, setSkippedItemIds] = useState(() => readSkippedItems(skippedStorageKey))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expandedImage, setExpandedImage] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [reviewingItems, setReviewingItems] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const positionedInitialItem = useRef(false)
  const productCardRef = useRef(null)
  const listButtonRef = useRef(null)
  const listCloseButtonRef = useRef(null)
  const swipeStart = useRef(null)

  useEffect(() => {
    if (orderedItems.length === 0 || positionedInitialItem.current) return
    const firstUnpicked = orderedItems.findIndex(
      (item) => (
        Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity) < item.quantity
          && !skippedItemIds.includes(item.id)
      ),
    )
    setCurrentIndex(firstUnpicked === -1 ? orderedItems.length - 1 : firstUnpicked)
    positionedInitialItem.current = true
  }, [orderedItems, pickedQuantities, skippedItemIds])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(pickedQuantities))
  }, [pickedQuantities, storageKey])

  useEffect(() => {
    window.localStorage.setItem(skippedStorageKey, JSON.stringify(skippedItemIds))
  }, [skippedItemIds, skippedStorageKey])

  useEffect(() => {
    if (!expandedImage && !listOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      if (expandedImage) setExpandedImage(false)
      else setListOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expandedImage, listOpen])

  useEffect(() => {
    if (listOpen) listCloseButtonRef.current?.focus()
  }, [listOpen])

  const totalUnits = useMemo(
    () => orderedItems.reduce((total, item) => total + item.quantity, 0),
    [orderedItems],
  )
  const pickedUnits = useMemo(() => orderedItems.reduce((total, item) => (
    total + Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity)
  ), 0), [orderedItems, pickedQuantities])
  const currentItem = orderedItems[currentIndex]
  const skippedItemIdSet = useMemo(() => new Set(skippedItemIds), [skippedItemIds])
  const currentPickedQuantity = currentItem
    ? Math.min(Number(pickedQuantities[currentItem.id]) || 0, currentItem.quantity)
    : 0
  const skippedUnits = useMemo(() => orderedItems.reduce((total, item) => (
    skippedItemIdSet.has(item.id)
      ? total + Math.max(0, item.quantity - Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity))
      : total
  ), 0), [orderedItems, pickedQuantities, skippedItemIdSet])
  const isComplete = totalUnits > 0 && pickedUnits === totalUnits
  const isReadyToFinish = orderedItems.length > 0 && orderedItems.every((item) => (
    Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity) === item.quantity
      || skippedItemIdSet.has(item.id)
  ))
  const isCurrentSkipped = currentItem ? skippedItemIdSet.has(currentItem.id) : false
  const showCompletion = isReadyToFinish && !reviewingItems
  const progress = totalUnits ? Math.round((pickedUnits / totalUnits) * 100) : 0

  function scrollToCurrentProduct() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        productCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  function closeList() {
    setListOpen(false)
    window.requestAnimationFrame(() => listButtonRef.current?.focus())
  }

  function showItem(index) {
    const nextIndex = Math.max(0, Math.min(orderedItems.length - 1, index))
    setCurrentIndex(nextIndex)
    setExpandedImage(false)
    setListOpen(false)
    setReviewingItems(true)
    scrollToCurrentProduct()
  }

  function handleTouchStart(event) {
    const touch = event.touches[0]
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function handleTouchEnd(event) {
    const start = swipeStart.current
    const touch = event.changedTouches[0]
    swipeStart.current = null
    if (!start || !touch) return

    const horizontalDistance = touch.clientX - start.x
    const verticalDistance = touch.clientY - start.y
    if (Math.abs(horizontalDistance) < 55 || Math.abs(horizontalDistance) < Math.abs(verticalDistance) * 1.2) return

    if (horizontalDistance < 0 && currentIndex < orderedItems.length - 1) showItem(currentIndex + 1)
    if (horizontalDistance > 0 && currentIndex > 0) showItem(currentIndex - 1)
  }

  function findNextUnresolved(startIndex, quantities, skippedIds) {
    for (let offset = 1; offset <= orderedItems.length; offset += 1) {
      const candidateIndex = (startIndex + offset) % orderedItems.length
      const candidate = orderedItems[candidateIndex]
      const candidatePicked = Math.min(Number(quantities[candidate.id]) || 0, candidate.quantity)
      if (candidatePicked < candidate.quantity && !skippedIds.has(candidate.id)) {
        return candidateIndex
      }
    }
    return null
  }

  function incrementCurrentItem() {
    if (!currentItem) return

    setPickedQuantities((current) => {
      const currentQuantity = Math.min(Number(current[currentItem.id]) || 0, currentItem.quantity)
      if (currentQuantity >= currentItem.quantity) return current

      const nextQuantity = currentQuantity + 1
      const next = { ...current, [currentItem.id]: nextQuantity }

      if (nextQuantity === currentItem.quantity) {
        const candidateIndex = findNextUnresolved(currentIndex, next, skippedItemIdSet)
        if (candidateIndex !== null) {
          setCurrentIndex(candidateIndex)
          setExpandedImage(false)
          scrollToCurrentProduct()
        } else {
          setReviewingItems(false)
        }
      }

      return next
    })
  }

  function decrementCurrentItem() {
    if (!currentItem || currentPickedQuantity === 0) return

    setPickedQuantities((current) => ({
      ...current,
      [currentItem.id]: Math.max(0, currentPickedQuantity - 1),
    }))
  }

  function toggleCurrentSkip() {
    if (!currentItem || currentPickedQuantity === currentItem.quantity) return

    const nextSkippedIds = new Set(skippedItemIds)
    if (isCurrentSkipped) {
      nextSkippedIds.delete(currentItem.id)
      setSkippedItemIds([...nextSkippedIds])
      return
    }

    nextSkippedIds.add(currentItem.id)
    setSkippedItemIds([...nextSkippedIds])
    const candidateIndex = findNextUnresolved(currentIndex, pickedQuantities, nextSkippedIds)
    if (candidateIndex !== null) {
      setCurrentIndex(candidateIndex)
      setExpandedImage(false)
      scrollToCurrentProduct()
    } else {
      setReviewingItems(false)
    }
  }

  function clearProgress() {
    setPickedQuantities({})
    setSkippedItemIds([])
    setCurrentIndex(0)
    setReviewingItems(false)
  }

  function buildOrderResults() {
    return selectedOrders.flatMap((order) => {
      const orderItems = orderedItems.flatMap((item) => {
        const orderEntry = item.orders.find((entry) => entry.id === order.id)
        return orderEntry ? [{ item, orderQuantity: orderEntry.quantity }] : []
      })
      const hasPickedUnits = orderItems.some(({ item }) => (
        Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity) > 0
      ))

      if (!hasPickedUnits) return []

      const fullyPicked = orderItems.every(({ item }) => (
        Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity) === item.quantity
      ))
      const summaryLines = orderItems.map(({ item, orderQuantity }) => {
        const pickedQuantity = Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity)
        const label = formatItemLabel(item)
        if (pickedQuantity === item.quantity) return `Picked: ${label} ×${orderQuantity}`
        if (pickedQuantity > 0) {
          const sharedText = item.orders.length > 1 ? ' across selected orders' : ''
          return `Partial: ${label} — ${pickedQuantity}/${item.quantity} picked${sharedText}; this order needs ${orderQuantity}`
        }
        return `Not picked: ${label} ×${orderQuantity}${skippedItemIdSet.has(item.id) ? ' (skipped)' : ''}`
      })

      return [{
        id: order.id,
        status: fullyPicked ? 'picked' : 'partial',
        summary: summaryLines.join('\n').slice(0, 4000),
      }]
    })
  }

  async function finishSession() {
    setFinishing(true)
    setFinishError('')

    try {
      const orderResults = buildOrderResults()
      if (orderResults.length > 0) {
        const response = await fetch('/api/tag-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderResults }),
        })
        if (!response.ok) throw new Error(`Saving picked status failed (${response.status})`)
      }

      window.localStorage.removeItem(storageKey)
      window.localStorage.removeItem(skippedStorageKey)
      onHome()
    } catch (saveError) {
      console.error('Failed to save picked order status', saveError)
      setFinishError('Picked status could not be saved to Shopify. Please try again.')
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <Page narrowWidth>
        <div className="state-panel state-panel--large">
          <FunnyLoading />
        </div>
      </Page>
    )
  }

  if (error) {
    return (
      <Page narrowWidth>
        <div className="state-panel state-panel--large state-panel--error" role="alert">
          <Text variant="headingMd" as="h1">Unable to start mobile picking</Text>
          <Text as="p">{error}</Text>
          <div className="button-row">
            <Button onClick={onBack}>Back to orders</Button>
            <Button variant="primary" onClick={retry}>Try again</Button>
          </div>
        </div>
      </Page>
    )
  }

  if (!currentItem) {
    return (
      <Page narrowWidth>
        <div className="state-panel state-panel--large">
          <Text variant="headingLg" as="h1">Nothing to pick</Text>
          <Text as="p" tone="subdued">The selected orders only contain excluded products.</Text>
          <Button onClick={onBack}>Choose different orders</Button>
        </div>
      </Page>
    )
  }

  return (
    <Page narrowWidth>
      <main className="mobile-picker">
        <header className="mobile-header">
          <button className="text-back" type="button" onClick={onBack}>← Orders</button>
          <button className="text-back" type="button" onClick={onHome}>Picking options</button>
        </header>

        <section
          className="mobile-progress"
          aria-label={`${pickedUnits} of ${totalUnits} units picked${skippedUnits ? `, ${skippedUnits} skipped` : ''}`}
        >
          <div className="mobile-progress-copy">
            <div>
              <span className="mobile-eyebrow">MOBILE PICKING</span>
              <Text variant="headingLg" as="h1">{pickedUnits} of {totalUnits} units picked</Text>
              {skippedUnits ? <span className="mobile-skipped-summary">{skippedUnits} skipped</span> : null}
            </div>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </section>

        {showCompletion ? (
          <section className="completion-card">
            <div className={`completion-check ${isComplete ? '' : 'is-partial'}`}>
              {isComplete ? '✓' : '!'}
            </div>
            <Text variant="headingXl" as="h2">{isComplete ? 'That’s the lot.' : 'Pick list reviewed'}</Text>
            {isComplete ? (
              <p>
                All {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} for{' '}
                {selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}{' '}
                {totalUnits === 1 ? 'is' : 'are'} marked picked.
              </p>
            ) : (
              <p>
                {pickedUnits} of {totalUnits} units picked. {skippedUnits}{' '}
                {skippedUnits === 1 ? 'unit was' : 'units were'} skipped and will remain visible as needing attention.
              </p>
            )}
            <Button
              variant="primary"
              size="large"
              loading={finishing}
              onClick={finishSession}
            >
              {pickedUnits > 0 ? 'Save results and finish' : 'Finish without changing orders'}
            </Button>
            {finishError ? <p className="finish-error" role="alert">{finishError}</p> : null}
            {!isComplete ? (
              <button className="text-button" type="button" onClick={() => setListOpen(true)}>
                Review items
              </button>
            ) : null}
            <button className="text-button" type="button" onClick={clearProgress}>Start this list over</button>
          </section>
        ) : (
          <section
            className="mobile-product-card"
            ref={productCardRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label={`${currentItem.productTitle}. Swipe left or right to change products.`}
          >
            <div className="mobile-position">Product {currentIndex + 1} of {orderedItems.length}</div>
            <div className="mobile-product-overview">
              <button
                className="mobile-product-image"
                type="button"
                onClick={() => setExpandedImage(true)}
                aria-label={`Expand image for ${currentItem.productTitle}`}
              >
                <img src={currentItem.image} alt="" />
                <span className="image-expand-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
                  </svg>
                </span>
              </button>
              <div className="mobile-product-details">
                <div className="product-vendor">{currentItem.vendor}</div>
                <Text variant="headingLg" as="h2">{currentItem.productTitle}</Text>
                {currentItem.attributes ? <div className="mobile-variant">{currentItem.attributes}</div> : null}
                <div className="mobile-sku">SKU {currentItem.sku || 'not provided'}</div>
              </div>
            </div>

            <div className="mobile-facts">
              <div><span>To pick</span><strong>{currentItem.quantity}</strong></div>
              <div><span>On hand</span><strong>{currentItem.stock}</strong></div>
            </div>

            <div className="mobile-pick-actions">
              <button
                className={`pick-action ${currentPickedQuantity === currentItem.quantity ? 'is-picked' : ''}`}
                type="button"
                onClick={incrementCurrentItem}
                disabled={currentPickedQuantity === currentItem.quantity || isCurrentSkipped}
              >
                {currentPickedQuantity === currentItem.quantity
                  ? '✓ All units picked'
                  : isCurrentSkipped
                    ? 'Skipped — undo to pick'
                    : `Mark 1 picked (${currentPickedQuantity + 1} of ${currentItem.quantity})`}
              </button>
              <button
                className={`skip-action ${isCurrentSkipped ? 'is-skipped' : ''}`}
                type="button"
                onClick={toggleCurrentSkip}
                disabled={currentPickedQuantity === currentItem.quantity}
              >
                {isCurrentSkipped ? 'Undo skip' : 'Skip'}
              </button>
            </div>
            <div className="partial-pick-status" aria-live="polite">
              <span>
                <strong>{currentPickedQuantity}</strong> of {currentItem.quantity} picked
                {isCurrentSkipped ? ' · remainder skipped' : ''}
              </span>
              <button
                className="text-button"
                type="button"
                onClick={decrementCurrentItem}
                disabled={currentPickedQuantity === 0}
              >
                Undo one
              </button>
            </div>

            <div className="mobile-orders">
              <div className="detail-label">For these orders</div>
              {currentItem.orders.map((order) => (
                <div className="mobile-order-row" key={order.id}>
                  <span>{order.name}</span><strong>× {order.quantity}</strong>
                </div>
              ))}
            </div>

          </section>
        )}

        {!showCompletion ? (
          <nav className="mobile-bottom-nav" aria-label="Product navigation">
            <button
              className="mobile-nav-button"
              type="button"
              disabled={currentIndex === 0}
              onClick={() => showItem(currentIndex - 1)}
            >
              <span aria-hidden="true">←</span>
              <span>Previous</span>
            </button>
            <button
              className="mobile-nav-button mobile-nav-button--list"
              type="button"
              ref={listButtonRef}
              onClick={() => setListOpen(true)}
              aria-haspopup="dialog"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
              <span>List</span>
              <span className="mobile-nav-count">{currentIndex + 1}/{orderedItems.length}</span>
            </button>
            <button
              className="mobile-nav-button"
              type="button"
              disabled={currentIndex === orderedItems.length - 1}
              onClick={() => showItem(currentIndex + 1)}
            >
              <span>Next</span>
              <span aria-hidden="true">→</span>
            </button>
          </nav>
        ) : null}

        {listOpen ? (
          <div className="pick-list-modal" role="presentation" onClick={closeList}>
            <section
              className="pick-list-modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pick-list-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="pick-list-modal-header">
                <div>
                  <Text variant="headingLg" as="h2" id="pick-list-title">Pick list</Text>
                  <p>
                    {pickedUnits} of {totalUnits} units picked
                    {skippedUnits ? ` · ${skippedUnits} skipped` : ''}
                  </p>
                </div>
                <button
                  className="modal-close-button"
                  type="button"
                  ref={listCloseButtonRef}
                  onClick={closeList}
                  aria-label="Close pick list"
                >
                  ×
                </button>
              </header>
              <div className="pick-list-modal-actions">
                <span>Tap a product to jump to it</span>
                <button className="text-button" type="button" onClick={clearProgress}>Reset progress</button>
              </div>
              <div className="queue-items">
                {orderedItems.map((item, index) => {
                  const itemPickedQuantity = Math.min(
                    Number(pickedQuantities[item.id]) || 0,
                    item.quantity,
                  )
                  const picked = itemPickedQuantity === item.quantity
                  const skipped = skippedItemIdSet.has(item.id)
                  return (
                    <button
                      className={`queue-item ${index === currentIndex ? 'is-current' : ''} ${picked ? 'is-picked' : ''} ${skipped ? 'is-skipped' : ''}`}
                      type="button"
                      key={item.id}
                      onClick={() => showItem(index)}
                      aria-pressed={index === currentIndex}
                      aria-label={`${item.productTitle}, ${itemPickedQuantity} of ${item.quantity} picked${skipped ? ', skipped' : ''}`}
                    >
                      <span className="queue-thumbnail">
                        <img src={item.image} alt="" />
                        {picked ? <span className="queue-picked-check" aria-hidden="true">✓</span> : null}
                        {!picked && itemPickedQuantity > 0 ? (
                          <span className="queue-partial-count">{itemPickedQuantity}/{item.quantity}</span>
                        ) : null}
                      </span>
                      <span className="queue-copy">
                        <strong>{item.productTitle}</strong>
                        <span>{item.attributes || item.sku || 'No variant'}</span>
                      </span>
                      <span className={`queue-quantity ${skipped ? 'is-skipped' : ''}`}>
                        {skipped ? 'Skipped' : `${itemPickedQuantity}/${item.quantity}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        ) : null}

        {expandedImage ? (
          <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded image for ${currentItem.productTitle}`}
            onClick={() => setExpandedImage(false)}
          >
            <button
              className="lightbox-close"
              type="button"
              onClick={() => setExpandedImage(false)}
              aria-label="Close expanded image"
            >
              ×
            </button>
            <img
              src={currentItem.image}
              alt={currentItem.productTitle}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </main>
    </Page>
  )
}

export default MobilePicker
