"use client";

import { useId, useState } from "react";

import { Slider } from "@/components/ui/slider";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

/** The focus ring a keyboard user sees, forced on so it can be looked at. */
const FORCED_THUMB_FOCUS =
  "[&_input::-webkit-slider-thumb]:shadow-none [&_input::-webkit-slider-thumb]:focus-ring [&_input::-moz-range-thumb]:shadow-none [&_input::-moz-range-thumb]:focus-ring";

function SliderDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [zoom, setZoom] = useState(140);

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Slider"
        spec="§3.17"
        description="A native range input: arrows ±1 step, Page Up/Down ±10 steps, Home/End. The value reads out on the right and as aria-valuetext."
      >
        <Specimen label="Default · 140%" className="w-64">
          <div className="flex w-full items-center gap-4">
            <span id={id("zoom-default")} className="text-label">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-default")}
              min={100}
              max={300}
              step={10}
              defaultValue={140}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </Specimen>
        <Specimen label="Focus (ring forced on)" className="w-64">
          <div className="flex w-full items-center gap-4">
            <span id={id("zoom-focus")} className="text-label">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-focus")}
              className={FORCED_THUMB_FOCUS}
              min={100}
              max={300}
              step={10}
              defaultValue={140}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </Specimen>
        <Specimen label="Disabled" className="w-64">
          <div className="flex w-full items-center gap-4">
            <span id={id("zoom-disabled")} className="text-label text-disabled-foreground">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-disabled")}
              min={100}
              max={300}
              step={10}
              defaultValue={140}
              formatValue={(value) => `${value}%`}
              disabled
            />
          </div>
        </Specimen>
        <Specimen label="At min · 100% / at max · 300%" className="w-64">
          <div className="flex w-full flex-col">
            <Slider
              aria-label="Zoom at minimum"
              min={100}
              max={300}
              step={10}
              defaultValue={100}
              formatValue={(value) => `${value}%`}
            />
            <Slider
              aria-label="Zoom at maximum"
              min={100}
              max={300}
              step={10}
              defaultValue={300}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Crop dialog zoom"
        description="The live preview follows the thumb while you drag or press keys."
      >
        <div className="flex max-w-md flex-col gap-4 rounded-xl border border-border-subtle bg-card p-4">
          <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-muted">
            <div
              className="size-20 rounded-lg bg-primary transition-transform duration-100"
              style={{ transform: `scale(${zoom / 100})` }}
            />
          </div>
          <div className="flex items-center gap-4">
            <span id={id("zoom-live")} className="text-label">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-live")}
              min={100}
              max={300}
              step={10}
              value={zoom}
              onValueChange={setZoom}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </div>
      </Composition>
    </div>
  );
}

export default SliderDemo;
