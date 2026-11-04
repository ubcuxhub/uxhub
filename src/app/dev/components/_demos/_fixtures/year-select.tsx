import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";

/** The year-of-study options several form demos put in a Select. */
export function YearSelectOptions() {
  return (
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Year</SelectLabel>
        <SelectItem value="1">1st year</SelectItem>
        <SelectItem value="2">2nd year</SelectItem>
        <SelectItem value="3">3rd year</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectItem value="4">4th year</SelectItem>
      <SelectItem value="5">5th year or above</SelectItem>
    </SelectContent>
  );
}
