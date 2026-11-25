export function reversePlaylist(head) {
  let result = null;
  for (let n = head; n !== null; n = n.next) result = { value: n.value, next: result };
  return result;
}
