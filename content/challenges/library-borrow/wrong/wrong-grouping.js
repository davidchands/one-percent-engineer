export function canBorrow(cardActive, booksOut, isStaff) {
  return (isStaff || cardActive) && booksOut < 5;
}
