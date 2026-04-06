
import React from "react";
import {ArrowUpRight} from "lucide-react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "noBorder";
  children: React.ReactNode;
  onClick?: () => void;
  withArrow?: boolean;
  shorterHeight?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
  onClick,
  withArrow = true,
  shorterHeight = false,
  className = "",
}) => {
  const baseStyles =
    "flex items-center justify-center gap-3 rounded-full px-6 transition-all duration-300 ease-in-out cursor-pointer";

  const height = shorterHeight ? "h-11" : "h-13";

  const variants = {
    primary: "border-[2px] border-black bg-black hover:bg-white text-white hover:text-black",
    secondary: "border-[2px] border-black bg-white hover:bg-black text-black hover:text-white",
    noBorder: "bg-white hover:bg-black text-black hover:text-white"
  };

  const arrowIcon = <ArrowUpRight size={24} className={
    `transition-all duration-300 ease-in-out group-hover:rotate-45
    ${variant == "primary" ? "group-hover:text-black" : "group-hover:text-white"}`
  } />

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${height} ${variants[variant]} ${className} group`}
    >
      <b>{children}</b>
      {withArrow ? arrowIcon : null}
    </button>
  );
};

export default Button;
