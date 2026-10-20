import React from 'react'

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg>
)

export const IconPlay = () => (
  <Svg><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.82 1.03l11.6-7.2a1.2 1.2 0 0 0 0-2.06L8.82 3.77A1.2 1.2 0 0 0 7 4.8z" /></Svg>
)

export const IconPause = () => (
  <Svg>
    <rect x="5.5" y="4" width="4.6" height="16" rx="1.4" />
    <rect x="13.9" y="4" width="4.6" height="16" rx="1.4" />
  </Svg>
)

export const IconNext = () => (
  <Svg>
    <path d="M2.5 6.6v10.8a1 1 0 0 0 1.53.85L12 13.3v4.1a1 1 0 0 0 1.53.85l8.2-5.4a1 1 0 0 0 0-1.7l-8.2-5.4A1 1 0 0 0 12 6.6v4.1L4.03 5.75A1 1 0 0 0 2.5 6.6z" />
  </Svg>
)

export const IconPrev = () => (
  <Svg>
    <path d="M21.5 6.6v10.8a1 1 0 0 1-1.53.85L12 13.3v4.1a1 1 0 0 1-1.53.85l-8.2-5.4a1 1 0 0 1 0-1.7l8.2-5.4A1 1 0 0 1 12 6.6v4.1l7.97-4.95A1 1 0 0 1 21.5 6.6z" />
  </Svg>
)

export const IconNote = () => (
  <Svg>
    <path d="M19 3.2v11.3a3.2 3.2 0 1 1-1.6-2.77V7.4l-8 1.6v7.5a3.2 3.2 0 1 1-1.6-2.77V5.6a1 1 0 0 1 .8-.98l9.2-1.84A1 1 0 0 1 19 3.2z" />
  </Svg>
)
