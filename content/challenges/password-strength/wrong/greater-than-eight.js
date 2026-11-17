function hasDigit(t) { for (let i = 0; i < t.length; i++) if (t[i] >= "0" && t[i] <= "9") return true; return false; }
function hasUpper(t) { for (let i = 0; i < t.length; i++) if (t[i] >= "A" && t[i] <= "Z") return true; return false; }
export function isStrongPassword(p) {
  return p.length > 8 && hasDigit(p) && hasUpper(p);
}
