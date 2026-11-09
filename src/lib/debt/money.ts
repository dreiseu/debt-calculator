/**
 * All engine math is done in integer centavos (₱1 = 100) so repeated
 * monthly interest never accumulates floating-point drift.
 */
export type Centavos = number;

export const toCentavos = (pesos: number): Centavos => Math.round(pesos * 100);

export const toPesos = (amount: Centavos): number => amount / 100;

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export const formatPeso = (amount: Centavos): string =>
  pesoFormatter.format(amount / 100);
