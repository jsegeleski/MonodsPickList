import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Page, Text } from '@shopify/polaris'
import FunnyLoading from './FunnyLoading'
import usePickListData from './usePickListData'

function readProgress(storageKey) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    return new Set(Array.isArray(stored) ? stored : [])
  } catch {
    return new Set()
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
  const [pickedIds, setPickedIds] = useState(() => readProgress(storageKey))
  const [currentIndex, setCurrentIndex] = useState(0)
  const positionedInitialItem = useRef(false)

  useEffect(() => {
    if (orderedItems.length === 0 || positionedInitialItem.current) return
    const firstUnpicked = orderedItems.findIndex((item) => !pickedIds.has(item.id))
    setCurrentIndex(firstUnpicked === -1 ? orderedItems.length - 1 : firstUnpicked)
    positionedInitialItem.current = true
  }, [orderedItems, pickedIds])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify([...pickedIds]))
  }, [pickedIds, storageKey])

  const validPickedIds = useMemo(
    () => new Set([...pickedIds].filter((id) => orderedItems.some((item) => item.id === id))),
    [orderedItems, pickedIds],
  )
  const pickedCount = validPickedIds.size
  const currentItem = orderedItems[currentIndex]
  const isComplete = orderedItems.length > 0 && pickedCount === orderedItems.length
  const progress = orderedItems.length ? Math.round((pickedCount / orderedItems.length) * 100) : 0

  function toggleCurrentItem() {
    if (!currentItem) return

    setPickedIds((current) => {
      const next = new Set(current)
      const wasPicked = next.has(currentItem.id)
      if (wasPicked) next.delete(currentItem.id)
      else next.add(currentItem.id)

      if (!wasPicked) {
        for (let offset = 1; offset <= orderedItems.length; offset += 1) {
          const candidateIndex = (currentIndex + offset) % orderedItems.length
          if (!next.has(orderedItems[candidateIndex].id)) {
            setCurrentIndex(candidateIndex)
            break
          }
        }
      }

      return next
    })
  }

  function clearProgress() {
    setPickedIds(new Set())
    setCurrentIndex(0)
  }

  function finishSession() {
    window.localStorage.removeItem(storageKey)
    onHome()
  }

  if (loading) {
    return (
      <Page narrowWidth>
        <div className="state-panel state-panel--large">
          <FunnyLoading title="Getting your mobile pick ready…" />
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

        <section className="mobile-progress" aria-label={`${pickedCount} of ${orderedItems.length} products picked`}>
          <div className="mobile-progress-copy">
            <div>
              <span className="mobile-eyebrow">MOBILE PICKING</span>
              <Text variant="headingLg" as="h1">{pickedCount} of {orderedItems.length} picked</Text>
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
              All {orderedItems.length} {orderedItems.length === 1 ? 'product' : 'products'} across{' '}
              {selectedOrders.length} {selectedOrders.length === 1 ? 'order is' : 'orders are'} marked picked.
            </p>
            <Button variant="primary" size="large" onClick={finishSession}>Finish and return home</Button>
            <button className="text-button" type="button" onClick={clearProgress}>Start this list over</button>
          </section>
        ) : (
          <section className="mobile-product-card">
            <div className="mobile-position">Product {currentIndex + 1} of {orderedItems.length}</div>
            <div className="mobile-product-image">
              <img src={currentItem.image} alt="" />
              <span className="mobile-quantity-badge">Pick {currentItem.quantity}</span>
            </div>
            <div className="mobile-product-details">
              <div className="product-vendor">{currentItem.vendor}</div>
              <Text variant="headingXl" as="h2">{currentItem.productTitle}</Text>
              {currentItem.attributes ? <div className="mobile-variant">{currentItem.attributes}</div> : null}
              <div className="mobile-sku">SKU {currentItem.sku || 'not provided'}</div>
            </div>

            <div className="mobile-facts">
              <div><span>To pick</span><strong>{currentItem.quantity}</strong></div>
              <div><span>On hand</span><strong>{currentItem.stock}</strong></div>
            </div>

            <div className="mobile-orders">
              <div className="detail-label">For these orders</div>
              {currentItem.orders.map((order) => (
                <div className="mobile-order-row" key={order.id}>
                  <span>{order.name}</span><strong>× {order.quantity}</strong>
                </div>
              ))}
            </div>

            <button
              className={`pick-action ${pickedIds.has(currentItem.id) ? 'is-picked' : ''}`}
              type="button"
              onClick={toggleCurrentItem}
            >
              {pickedIds.has(currentItem.id) ? '✓ Marked picked — undo' : `Mark ${currentItem.quantity} as picked`}
            </button>

            <div className="mobile-navigation">
              <Button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              >
                Previous
              </Button>
              <Button
                disabled={currentIndex === orderedItems.length - 1}
                onClick={() => setCurrentIndex((index) => Math.min(orderedItems.length - 1, index + 1))}
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
              const picked = pickedIds.has(item.id)
              return (
                <button
                  className={`queue-item ${index === currentIndex ? 'is-current' : ''} ${picked ? 'is-picked' : ''}`}
                  type="button"
                  key={item.id}
                  onClick={() => setCurrentIndex(index)}
                  aria-pressed={index === currentIndex}
                >
                  <span className="queue-status">{picked ? '✓' : index + 1}</span>
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
      </main>
    </Page>
  )
}

export default MobilePicker
