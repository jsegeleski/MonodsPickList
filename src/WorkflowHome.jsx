import { Text } from '@shopify/polaris'

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
      <path d="M17.5 11h.01" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M10 5h4M11 18l1.5 1.5L16 16" />
    </svg>
  )
}

function WorkflowHome({ onChoose }) {
  return (
    <main className="workflow-home">
      <div className="home-eyebrow">MONOD SPORTS</div>
      <Text variant="heading2xl" as="h1">How are you picking today?</Text>
      <p className="home-intro">
        Choose a workflow, select the orders, and we’ll combine matching products for you.
      </p>

      <div className="workflow-options">
        <button className="workflow-option" type="button" onClick={() => onChoose('print')}>
          <span className="workflow-icon"><PrinterIcon /></span>
          <span className="workflow-kicker">PRINTED LIST</span>
          <strong>Print a pick list</strong>
          <span className="workflow-description">
            Create a condensed sheet to hand to a staff member for picking.
          </span>
          <span className="workflow-best">Best for handing off</span>
          <span className="workflow-arrow" aria-hidden="true">→</span>
        </button>

        <button className="workflow-option workflow-option--mobile" type="button" onClick={() => onChoose('mobile')}>
          <span className="workflow-icon"><PhoneIcon /></span>
          <span className="workflow-kicker">MOBILE PICKING</span>
          <strong>Pick on your phone</strong>
          <span className="workflow-description">
            Work through products one at a time and mark each item as picked.
          </span>
          <span className="workflow-best">Best for picking yourself</span>
          <span className="workflow-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  )
}

export default WorkflowHome
