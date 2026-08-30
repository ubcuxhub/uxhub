import Button from "@/features/marketing/components/Button";

const EventsSection = () => {
  return (
    <div id="events" className="px-[5%] md:px-[20%]">
      <div className="mb-8">
        <p className="mb-0 text-gray font-serif italic font-semibold text-[32px]">
          events
        </p>
        <h2 className=" text-[40px] font-bold leading-tight">
          Learn by doing, connect by creating
        </h2>
      </div>

      <div className="flex flex-col items-center gap-8 py-16 text-center">
        <div className="flex flex-col gap-2">
          <p className="text-gray text-xl font-semibold">
            Events are coming soon.
          </p>
          <p className="text-gray">
            Follow us for announcements about what we have planned.
          </p>
        </div>

        <Button href="https://linktr.ee/ubcuxhub" external>
          FOLLOW ON LINKTREE
        </Button>
      </div>
    </div>
  );
};

export default EventsSection;
