import React from "react";
import AboutImageStack from "../components/AboutImageStack";

function AboutUsSection() {
  return (
    <div id="about-us" className="md:px-[10%] px-[5%] pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
        {/* Left text section */}
        <div className="flex-1 flex flex-col">
          <p className="mb-0 font-serif italic font-semibold text-gray text-[31.871px]">
            who we are
          </p>
          <h2 className="text-[40px] font-bold leading-tight">
            Empowering the next generation of UX designers
          </h2>
          <p className="pt-8 text-[20px]">
            Founded in February 2017 as UBC&apos;s{" "}
            <strong>first and only user experience club</strong>, UBC UX Hub
            is a growing collective of{" "}
            <strong>design-passionate students</strong>. We empower emerging
            designers through hands-on workshops, industry talks, and
            networking events that help bridge the gap between classroom
            learning and real-world practice.
          </p>
          <p className="pt-4 text-[20px]">
            Our mission is to <strong>foster growth and community</strong>{" "}
            within the design field. Whether you&apos;re an aspiring
            designer or a seasoned expert, we invite you to join us on our
            journey to{" "}
            <strong>fully explore the world of UX design</strong>.
          </p>
        </div>

        {/* Right image stack */}
        <div className="lg:flex-shrink-0 pt-12">
          <AboutImageStack />
        </div>
      </div>
    </div>
  );
}

export default AboutUsSection;
