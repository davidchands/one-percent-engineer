export function reversePlaylist(head) {
  if (head === null) return null;
  let previous = head;
  let current = head.next;
  while (current !== null) {
    const following = current.next;
    current.next = previous;
    previous = current;
    current = following;
  }
  return previous;
}
