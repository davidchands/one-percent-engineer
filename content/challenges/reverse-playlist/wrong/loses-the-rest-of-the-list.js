export function reversePlaylist(head) {
  let previous = null;
  let current = head;
  while (current !== null) {
    current.next = previous;
    previous = current;
    current = current.next;
  }
  return previous;
}
