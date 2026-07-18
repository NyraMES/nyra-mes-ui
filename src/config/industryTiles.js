import autoImage from "../assets/automobile-oem.png";
import carbonImage from "../assets/activated-carbon.png";

export const INDUSTRY_TILES = [
  {
    key: "activated-carbon",
    image: carbonImage,
    imageAlt: "Activated Carbon Plant",
    label: "MATERIALS AND PROCESS INDUSTRIES",
    name: "Activated Carbon Plant",
    description:
      "End-to-end production visibility for activated carbon — from raw material to dispatch, with quality and yield insights.",
    featured: false
  },
  {
    key: "chemical",
    image: carbonImage,
    imageAlt: "Chemical Processing Plant",
    label: "REFINERY / PETROCHEMICALS",
    name: "Chemical Processing",
    description:
      "Real-time visibility for batch reactor operations, formulation, quality, and utility tracking.",
    featured: false
  },
  {
    key: "automotive-oem",
    image: autoImage,
    imageAlt: "Automobile OEM",
    label: "AUTOMOBILE / TIER-1 OEM · WORKFLOW INTELLIGENCE",
    name: "Automobile OEM",
    description:
      "Connected workflow intelligence — orders to dispatch — with feasibility reasoning, ontology graph and lot-level traceability. Every screen derives context from the upstream stage.",
    featured: true
  }
];
