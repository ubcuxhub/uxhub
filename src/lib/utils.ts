import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "h1",
            "h2",
            "h3",
            "subheading",
            "body",
            "body-medium",
            "small",
            "label",
            "table",
            "table-heading",
            "button",
            "button-small",
            "badge",
          ],
        },
      ],
      shadow: [{ shadow: ["overlay"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
