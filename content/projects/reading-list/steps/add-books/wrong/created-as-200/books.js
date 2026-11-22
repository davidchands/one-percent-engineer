let books = [];
let nextId = 1;

export function list() {
  return books;
}

export function add({ title, author, status = "want" }) {
  const book = { id: nextId++, title, author, status };
  books.push(book);
  return book;
}
