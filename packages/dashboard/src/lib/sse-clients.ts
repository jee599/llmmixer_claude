import type { SSEEvent } from '@llmmixer/core'

type SSEWriter = (event: SSEEvent) => void

const clients = new Set<SSEWriter>()

export function addClient(writer: SSEWriter): void {
  clients.add(writer)
}

export function removeClient(writer: SSEWriter): void {
  clients.delete(writer)
}

export function broadcast(event: SSEEvent): void {
  for (const writer of clients) {
    writer(event)
  }
}

export function getClientCount(): number {
  return clients.size
}
