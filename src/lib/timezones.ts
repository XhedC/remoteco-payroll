export interface TimezoneOption {
  value: string;
  label: string;
  group: string;
}

const FALLBACK_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function getOffsetLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function buildOptions(): TimezoneOption[] {
  let zones: string[];
  try {
    zones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }

  return zones
    .map((zone) => {
      const group = zone.includes("/") ? zone.split("/")[0] : "Other";
      const offset = getOffsetLabel(zone);
      const label = `${zone.replace(/_/g, " ")}${offset ? ` (${offset})` : ""}`;
      return { value: zone, label, group };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Computed once at module load so server and client render the same list.
export const TIMEZONE_OPTIONS: TimezoneOption[] = buildOptions();

export const TIMEZONE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TIMEZONE_OPTIONS.map((tz) => [tz.value, tz.label]),
);

export const TIMEZONE_GROUP_ORDER = [
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
  "Other",
];

export function groupedTimezoneOptions(): { group: string; options: TimezoneOption[] }[] {
  const byGroup = new Map<string, TimezoneOption[]>();
  for (const option of TIMEZONE_OPTIONS) {
    const list = byGroup.get(option.group) ?? [];
    list.push(option);
    byGroup.set(option.group, list);
  }

  return TIMEZONE_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
    group,
    options: byGroup.get(group)!,
  }));
}

export interface TimezoneComboboxGroup {
  value: string;
  items: TimezoneOption[];
}

// Same grouping, shaped for Base UI Combobox's grouped `items` prop
// (an array of { items: [...] } groups, with an extra key used as the heading).
export const TIMEZONE_COMBOBOX_GROUPS: TimezoneComboboxGroup[] = groupedTimezoneOptions().map(
  ({ group, options }) => ({ value: group, items: options }),
);

export const TIMEZONE_ITEM_BY_VALUE: Record<string, TimezoneOption> = Object.fromEntries(
  TIMEZONE_OPTIONS.map((tz) => [tz.value, tz]),
);
