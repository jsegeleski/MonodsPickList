import { useMemo } from 'react'

const gifCount = 15
const captions = [
  'Checking every shelf twice…',
  'Convincing identical SKUs to stand together…',
  'Finding the one box behind all the other boxes…',
  'Counting everything so you don’t have to…',
  'Politely asking inventory where it went…',
  'Preparing your aisle cardio…',
  'Looking for the medium that was definitely here yesterday…',
  'Grouping orders like a very organized mountain goat…',
  'Turning “just a few orders” into a plan…',
  'Making the stockroom slightly less mysterious…',
]

function FunnyLoading({ title = 'Building your pick list…' }) {
  const selection = useMemo(() => ({
    gif: `/gifs/loading-${Math.ceil(Math.random() * gifCount)}.gif`,
    caption: captions[Math.floor(Math.random() * captions.length)],
  }), [])

  return (
    <div className="funny-loading">
      <img src={selection.gif} alt="" />
      <div className="funny-loading-title">{title}</div>
      <div className="funny-loading-caption">{selection.caption}</div>
    </div>
  )
}

export default FunnyLoading
