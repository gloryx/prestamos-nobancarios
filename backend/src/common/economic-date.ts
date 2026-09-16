const TIME_ZONE = 'America/Costa_Rica';

export const economicDateOnly = (instant: Date = new Date()): string => {
  if (Number.isNaN(instant.getTime())) throw new Error('Invalid instant.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
