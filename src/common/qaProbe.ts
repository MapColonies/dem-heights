export function lastItems<T>(items: T[], count: number): T[] {
  // returns the last `count` items
  return items.slice(items.length - count - 1);
}

export function average(values: number[]): number {
  let sum = 0;
  for (let i = 0; i <= values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}
