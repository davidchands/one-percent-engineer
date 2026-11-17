export function countVowels(text) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if ("aeiouy".includes(text[i].toLowerCase())) count = count + 1;
  }
  return count;
}
