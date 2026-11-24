import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/** Question prompt widths, so the questions don't read as one stamped block. */
const QUESTION_WIDTHS = ["w-[60%]", "w-[45%]", "w-[70%]"];

/** An `ApplicationSection`: the "Section n" eyebrow and title above its card. */
function SectionSkeleton({ titleWidth, description, children }: {
  titleWidth: string;
  description?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-border [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-10 sm:[&:not(:first-child)]:pt-14">
      <div className="flex flex-col gap-2 pb-2">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className={`h-6 rounded-lg ${titleWidth}`} />
        {description ? <Skeleton className="h-3.5 w-80 max-w-full rounded-full" /> : null}
      </div>
      <div className="flex flex-col gap-8 rounded-xl border border-border bg-background p-5">
        {children}
      </div>
    </div>
  );
}

/**
 * The application page while it loads, shaped like `ApplicationForm`: the back
 * pill, the sticky header with the title and Submit, the intro, and the About
 * you, Your answers, and Review and submit sections, as static blocks (Portal
 * Motion handoff §2f). The back pill is a block too, since its label names the
 * event.
 */
export function ApplicationFormSkeleton() {
  return (
    <div className="flex flex-col pb-32" aria-busy="true">
      <span role="status" className="sr-only">
        Loading application
      </span>

      <div className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-6 sm:pt-10 lg:px-12">
        <Skeleton className="h-10 w-56 rounded-full" />
      </div>

      {/* Header: title and status badge, then Submit. */}
      <div className="mt-4 border-b border-border-subtle bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-12">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-2.5">
            <Skeleton className="h-7 w-72 max-w-full rounded-lg" />
            <Skeleton className="h-6 w-18 rounded-full" />
          </div>
          <Skeleton className="ml-auto h-11 w-24 rounded-full sm:h-10" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pt-6 sm:px-6 lg:px-12">
        {/* Intro: when applications close and how review works. */}
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-[60%] rounded-full" />
        </div>

        <div className="flex flex-col gap-10 sm:gap-14">
          {/* About you: four profile fields in two columns. */}
          <SectionSkeleton titleWidth="w-32">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {["w-20", "w-48", "w-24", "w-28"].map((width, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-24 rounded-full" />
                  <Skeleton className={`h-3.5 rounded-full ${width}`} />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-52 rounded-full" />
          </SectionSkeleton>

          {/* Your answers: three questions, each a prompt over a text box. */}
          <SectionSkeleton titleWidth="w-36" description>
            {QUESTION_WIDTHS.map((width, i) => (
              <div key={i} className="flex flex-col gap-8">
                {i > 0 ? <Separator className="bg-border-subtle" /> : null}
                <div className="flex flex-col gap-3">
                  <Skeleton className={`h-4 rounded-full ${width}`} />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </SectionSkeleton>

          {/* Review and submit: a heading and a line of guidance. */}
          <SectionSkeleton titleWidth="w-44" description>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4.5 w-36 rounded-full" />
              <Skeleton className="h-3.5 w-[70%] rounded-full" />
            </div>
          </SectionSkeleton>
        </div>
      </div>
    </div>
  );
}
