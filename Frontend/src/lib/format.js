const currency = import.meta.env.VITE_CURRENCY || "PKR";
const locale = currency === "PKR" ? "en-PK" : "en";

export function formatCurrency(value) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}
