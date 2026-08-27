"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryPill } from "@/components/research-radar/category-pill";
import { cn } from "@/lib/utils";

export function CategoryCombobox({
  categories,
  selected,
  onToggle,
}: {
  categories: string[];
  selected: Set<string>;
  onToggle: (category: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "h-auto rounded-full border-border px-3 py-1 text-xs font-medium text-muted-foreground",
                selected.size > 0 && "border-accent-indigo text-accent-indigo",
              )}
            >
              Tags{selected.size > 0 ? ` (${selected.size})` : ""}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          }
        />
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {categories.map((category) => (
                  <CommandItem
                    key={category}
                    value={category}
                    data-checked={selected.has(category)}
                    onSelect={() => onToggle(category)}
                  >
                    {category}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {Array.from(selected).map((category) => (
        <CategoryPill
          key={category}
          label={category}
          className="bg-accent-indigo text-white"
          onRemove={() => onToggle(category)}
        />
      ))}
    </div>
  );
}
