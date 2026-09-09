import { useMemo } from 'react'

const gifCount = 21

function FunnyLoading() {
  const gif = useMemo(
    () => `/gifs/loading-${Math.ceil(Math.random() * gifCount)}.gif`,
    [],
  )

  return (
    <div className="funny-loading">
      <img src={gif} alt="Loading" />
    </div>
  )
}

export default FunnyLoading
