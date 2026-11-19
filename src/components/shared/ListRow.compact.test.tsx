import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ListRow } from "./ListRow";
it("compact rows render optional time/status/action without replacing default artwork", () => {
  const compact = renderToStaticMarkup(<ul>
    <ListRow variant="compact" name="Ada" leading="7:42 PM" supporting="Going" action={<button>Check in</button>} />
  </ul>);
  expect(compact).toContain("7:42 PM");

  expect(compact).toContain("Going");

  expect(compact).toContain("Check in");

  expect(compact).not.toContain("avatar");
  const normal = renderToStaticMarkup(<ul>
    <ListRow name="Ada" lead={{ kind: "person" }} />
  </ul>);

  expect(normal).toContain("avatar");
});
