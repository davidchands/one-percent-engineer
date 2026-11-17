export function ticketPrice(age) {
  if (age < 12) return 5;
  else if (age >= 65) return 7;
  else if (age < 0) return null;
  else return 12;
}
