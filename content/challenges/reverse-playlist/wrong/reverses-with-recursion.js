export function reversePlaylist(head) {
  if (head === null || head.next === null) return head;
  const newHead = reversePlaylist(head.next);
  head.next.next = head;
  head.next = null;
  return newHead;
}
