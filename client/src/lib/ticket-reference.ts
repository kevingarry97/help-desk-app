export function ticketReference(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
