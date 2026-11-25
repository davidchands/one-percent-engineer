export function reversePlaylist(head) {
  let previous = null;
  let current = head;
  while (current !== null) {
    const following = current.next;
    current.next = previous;
    previous = current;
    current = following;
  }
  return previous;
}
