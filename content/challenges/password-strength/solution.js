function hasDigit(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] >= "0" && text[i] <= "9") return true;
  }
  return false;
}

function hasUpperCase(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] >= "A" && text[i] <= "Z") return true;
  }
  return false;
}

export function isStrongPassword(password) {
  return password.length >= 8 && hasDigit(password) && hasUpperCase(password);
}
