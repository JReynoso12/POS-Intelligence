export function money(n: number, currency = "PHP") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Compact currency for chart axes (PHP) */
export function moneyAxis(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "PHP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return money(n);
  }
}
