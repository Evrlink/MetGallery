'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function ConnectWallet() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isReconnecting) return null

  if (!isConnected) {
    return (
      <div className="flex gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            disabled={isConnecting}
            className="text-[11px] uppercase tracking-widest px-3.5 py-1.5 border border-gold/60 bg-transparent text-gold cursor-pointer font-body transition-colors hover:bg-gold hover:text-ivory disabled:opacity-50"
          >
            {connector.name === 'Base Account' ? 'Connect' : connector.name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] tracking-wide text-stone font-mono">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="text-[11px] uppercase tracking-widest px-3.5 py-1.5 border border-stone/40 bg-transparent text-stone cursor-pointer font-body transition-colors hover:border-gold hover:text-gold"
      >
        Disconnect
      </button>
    </div>
  )
}
