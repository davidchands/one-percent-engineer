export function canBorrow(cardActive, booksOut, isStaff) {
  return cardActive && booksOut < 5;
}
