export function formatCurrency(value) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
}
