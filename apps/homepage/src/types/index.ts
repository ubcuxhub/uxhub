export interface TeamMember {
  name: string;
  role: string;
  image: string;
  roleEmoji: string;
}

export interface Event {
  imageSrc: string;
  imageAlt: string;
  buttonText: string;
  icon: "triangle" | "star";
}
