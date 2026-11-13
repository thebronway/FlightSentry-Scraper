export function formatLocationDisplay(locationInput: string | string[]): string {
  const parts = (Array.isArray(locationInput) ? locationInput : [locationInput])
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return parts.join(',');
}