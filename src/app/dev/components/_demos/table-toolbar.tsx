import { Download, ListFilter } from "lucide-react";

import { TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function SelectedToolbar() {
  return (
    <TableToolbar
      search={<SearchField label="Search users" placeholder="Search users" />}
      selectedCount={2}
      bulkActions={
        <Button variant="secondary" size="sm">
          <Download aria-hidden />
          Export to CSV
        </Button>
      }
      onClearSelection={() => {}}
    />
  );
}

function TableToolbarDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="TableToolbar"
        spec="§3.16"
        description="Search fills the row; Sort and filter sits on the right until rows are selected."
        min="100%"
      >
        <Specimen label="Default" wide bare>
          <TableToolbar
            className="w-full"
            search={<SearchField label="Search users" placeholder="Search users" />}
            actions={
              <Button variant="secondary" size="sm">
                <ListFilter aria-hidden />
                Sort and filter
              </Button>
            }
          />
        </Specimen>
        <Specimen label="Searching" wide bare>
          <TableToolbar
            className="w-full"
            search={
              <SearchField
                label="Search users"
                placeholder="Search users"
                defaultValue="alex"
              />
            }
            actions={
              <Button variant="secondary" size="sm">
                <ListFilter aria-hidden />
                Sort and filter
              </Button>
            }
          />
        </Specimen>
        <Specimen label="Rows selected" wide bare>
          <div className="w-full">
            <SelectedToolbar />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TableToolbarDemo;
