import React from 'react'

const gifCount = 15
const randomGif = () => `/gifs/loading-${Math.ceil(Math.random() * gifCount)}.gif`

const FunnyLoading = () => {
  const gifSrc = React.useMemo(() => randomGif(), []) // lock to 1 gif per mount

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <img
        src={gifSrc}
        alt="Funny loading"
        style={{
          maxWidth: '100%',
          width: '300px',
          height: 'auto',
          marginBottom: '1rem',
          borderRadius: '8px'
        }}
      />
    </div>
  )
}

export default FunnyLoading