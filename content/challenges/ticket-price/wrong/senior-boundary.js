export function ticketPrice(age) {
  if (age < 0) return null;
  else if (age < 12) return 5;
  else if (age > 65) return 7;
  else return 12;
}
