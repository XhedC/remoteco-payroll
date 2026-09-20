"use client";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  TIMEZONE_COMBOBOX_GROUPS,
  TIMEZONE_ITEM_BY_VALUE,
  type TimezoneComboboxGroup,
  type TimezoneOption,
} from "@/lib/timezones";

export function TimezoneCombobox({
  value,
  onValueChange,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  const selected = TIMEZONE_ITEM_BY_VALUE[value] ?? null;

  return (
    <Combobox
      items={TIMEZONE_COMBOBOX_GROUPS}
      value={selected}
      onValueChange={(item) => item && onValueChange((item as TimezoneOption).value)}
    >
      <ComboboxInput id={id} placeholder="Search timezone..." />
      <ComboboxContent>
        <ComboboxEmpty>No timezone found.</ComboboxEmpty>
        <ComboboxList>
          {(group: TimezoneComboboxGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(item: TimezoneOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
