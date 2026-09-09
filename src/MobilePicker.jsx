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
  const [pickedQuantities, setPickedQuantities] = useState(() => readProgress(storageKey))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expandedImage, setExpandedImage] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const positionedInitialItem = useRef(false)

  useEffect(() => {
    if (orderedItems.length === 0 || positionedInitialItem.current) return
    const firstUnpicked = orderedItems.findIndex(
      (item) => Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity) < item.quantity,
    )
    setCurrentIndex(firstUnpicked === -1 ? orderedItems.length - 1 : firstUnpicked)
    positionedInitialItem.current = true
  }, [orderedItems, pickedQuantities])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(pickedQuantities))
  }, [pickedQuantities, storageKey])

  useEffect(() => {
    if (!expandedImage) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpandedImage(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expandedImage])

  const totalUnits = useMemo(
    () => orderedItems.reduce((total, item) => total + item.quantity, 0),
    [orderedItems],
  )
  const pickedUnits = useMemo(() => orderedItems.reduce((total, item) => (
    total + Math.min(Number(pickedQuantities[item.id]) || 0, item.quantity)
  ), 0), [orderedItems, pickedQuantities])
  const currentItem = orderedItems[currentIndex]
  const currentPickedQuantity = currentItem
    ? Math.min(Number(pickedQuantities[currentItem.id]) || 0, currentItem.quantity)
    : 0
  const isComplete = totalUnits > 0 && pickedUnits === totalUnits
  const progress = totalUnits ? Math.round((pickedUnits / totalUnits) * 100) : 0

  function incrementCurrentItem() {
    if (!currentItem) return

    setPickedQuantities((current) => {
      const currentQuantity = Math.min(Number(current[currentItem.id]) || 0, currentItem.quantity)
      if (currentQuantity >= currentItem.quantity) return current

      const nextQuantity = currentQuantity + 1
      const next = { ...current, [currentItem.id]: nextQuantity }

      if (nextQuantity === currentItem.quantity) {
        for (let offset = 1; offset <= orderedItems.length; offset += 1) {
          const candidateIndex = (currentIndex + offset) % orderedItems.length
          const candidate = orderedItems[candidateIndex]
          const candidatePicked = Math.min(Number(next[candidate.id]) || 0, candidate.quantity)
          if (candidatePicked < candidate.quantity) {
            setCurrentIndex(candidateIndex)
            setExpandedImage(false)
            break
          }
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

  function showItem(index) {
    setCurrentIndex(index)
    setExpandedImage(false)
  }

  function clearProgress() {
    setPickedQuantities({})
    setCurrentIndex(0)
  }

  async function finishSession() {
    setFinishing(true)
    setFinishError('')

    try {
      const response = await fetch('/api/tag-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: [...new Set(selectedOrders.map((order) => order.id))],
          tag: 'PLP-PICKED',
        }),
      })
      if (!response.ok) throw new Error(`Saving picked status failed (${response.status})`)

      window.localStorage.removeItem(storageKey)
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

        <section className="mobile-progress" aria-label={`${pickedUnits} of ${totalUnits} units picked`}>
          <div className="mobile-progress-copy">
            <div>
              <span className="mobile-eyebrow">MOBILE PICKING</span>
              <Text variant="headingLg" as="h1">{pickedUnits} of {totalUnits} units picked</Text>
            </div>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </section>

        {isComplete ? (
          <section className="completion-card">
            <div className="completion-check">✓</div>
            <Text variant="headingXl" as="h2">That’s the lot.</Text>
            <p>
              All {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} for{' '}
              {selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}{' '}
              {totalUnits === 1 ? 'is' : 'are'} marked picked.
            </p>
            <Button
              variant="primary"
              size="large"
              loading={finishing}
              onClick={finishSession}
            >
              Save picked status and finish
            </Button>
            {finishError ? <p className="finish-error" role="alert">{finishError}</p> : null}
            <button className="text-button" type="button" onClick={clearProgress}>Start this list over</button>
          </section>
        ) : (
          <section className="mobile-product-card">
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

            <button
              className={`pick-action ${currentPickedQuantity === currentItem.quantity ? 'is-picked' : ''}`}
              type="button"
              onClick={incrementCurrentItem}
              disabled={currentPickedQuantity === currentItem.quantity}
            >
              {currentPickedQuantity === currentItem.quantity
                ? '✓ All units picked'
                : `Mark 1 picked (${currentPickedQuantity + 1} of ${currentItem.quantity})`}
            </button>
            <div className="partial-pick-status" aria-live="polite">
              <span><strong>{currentPickedQuantity}</strong> of {currentItem.quantity} picked</span>
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

            <div className="mobile-navigation">
              <Button
                disabled={currentIndex === 0}
                onClick={() => showItem(Math.max(0, currentIndex - 1))}
              >
                Previous
              </Button>
              <Button
                disabled={currentIndex === orderedItems.length - 1}
                onClick={() => showItem(Math.min(orderedItems.length - 1, currentIndex + 1))}
              >
                Next
              </Button>
            </div>
          </section>
        )}

        <section className="pick-queue">
          <div className="queue-heading">
            <Text variant="headingMd" as="h2">Pick list</Text>
            <button className="text-button" type="button" onClick={clearProgress}>Reset</button>
          </div>
          <div className="queue-items">
            {orderedItems.map((item, index) => {
              const itemPickedQuantity = Math.min(
                Number(pickedQuantities[item.id]) || 0,
                item.quantity,
              )
              const picked = itemPickedQuantity === item.quantity
              return (
                <button
                  className={`queue-item ${index === currentIndex ? 'is-current' : ''} ${picked ? 'is-picked' : ''}`}
                  type="button"
                  key={item.id}
                  onClick={() => showItem(index)}
                  aria-pressed={index === currentIndex}
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
                  <span className="queue-quantity">× {item.quantity}</span>
                </button>
              )
            })}
          </div>
        </section>

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
