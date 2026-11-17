export function countVowels(text) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toLowerCase();
    if ("aeiou".includes(ch)) {
      count = count + 1;
    }
  }
  return count;
}
