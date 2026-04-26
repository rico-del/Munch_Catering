import { Booking, MenuTier } from '@/lib/munch-data';

const preferredTierNames = ['Standard', 'Premium', 'Deluxe'];

export function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));
}

export function sortTiers(tiers: MenuTier[]) {
  return [...tiers].sort((left, right) => {
    const leftIndex = preferredTierNames.indexOf(left.name);
    const rightIndex = preferredTierNames.indexOf(right.name);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function toIncrementalTiers(tiers: MenuTier[]) {
  const running = new Set<string>();
  return sortTiers(tiers).map(tier => {
    const fullItems = uniqueItems(tier.items);
    const extras = fullItems.filter(item => !running.has(item));
    fullItems.forEach(item => running.add(item));
    return {
      ...tier,
      items: extras.length ? extras : fullItems,
    };
  });
}

export function toCumulativeTiers(tiers: MenuTier[]) {
  const running: string[] = [];
  return sortTiers(tiers).map(tier => {
    const combined = uniqueItems([...running, ...tier.items]);
    running.splice(0, running.length, ...combined);
    return {
      ...tier,
      items: combined,
    };
  });
}

export function getTierPreviewItems(tiers: MenuTier[], index: number) {
  return toCumulativeTiers(tiers)[index]?.items || [];
}

export function toSentenceCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function getBookingStatusTone(booking: Booking) {
  if (booking.lifecycleStage === 'completed') return 'muted';
  if (booking.lifecycleStage === 'cancelled') return 'muted';
  return 'default';
}

export function resolvePrimaryPortfolioItem<T extends { isPrimary?: boolean }>(items: T[]): T | null {
  return items.find(item => item.isPrimary) || items[0] || null;
}
