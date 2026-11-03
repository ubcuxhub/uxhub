"use client";

import { useState } from "react";

import { Pagination } from "@/components/ui/pagination";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

/** Steps through a 48-row list, five to a page, with the state the caller owns. */
function Interactive() {
  const [page, setPage] = useState(3);
  return (
    <Pagination
      className="w-full rounded-xl border"
      page={page}
      pageSize={5}
      total={48}
      onPageChange={setPage}
    />
  );
}

function PaginationDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Pagination"
        spec="§3.4, §3.16"
        description="Sits at the foot of a TableCard. Previous and next are disabled at the ends. For server lists pass getPageHref and they render as links."
      >
        <Specimen label="First page" className="w-96">
          <Pagination
            className="w-full rounded-xl border"
            page={1}
            pageSize={10}
            total={48}
            onPageChange={() => {}}
          />
        </Specimen>
        <Specimen label="Last page" className="w-96">
          <Pagination
            className="w-full rounded-xl border"
            page={5}
            pageSize={10}
            total={48}
            onPageChange={() => {}}
          />
        </Specimen>
        <Specimen label="Interactive" className="w-96">
          <Interactive />
        </Specimen>
        <Specimen label="One page: both buttons disabled" className="w-96">
          <Pagination
            className="w-full rounded-xl border"
            page={1}
            pageSize={10}
            total={7}
            onPageChange={() => {}}
          />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default PaginationDemo;
