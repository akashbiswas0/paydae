import Link from "next/link";
import { PERSONAS } from "@/lib/types";

const CARDS = [
  { ...PERSONAS.company, blurb: "The company · runs payday" },
  { ...PERSONAS.alice, blurb: "Contractor · Designer" },
  { ...PERSONAS.bob, blurb: "Contractor · Engineer" },
];

export default function PickerPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-5 pt-[12vh]">
      <h1 className="text-5xl font-extrabold tracking-tight">Paydae</h1>
      <p className="mb-4 text-muted-foreground">
        Confidential contractor payroll on Canton. Pick a persona:
      </p>
      <div className="flex flex-wrap justify-center gap-4 px-4">
        {CARDS.map((card) => (
          <Link
            key={card.route}
            href={card.route}
            className={`block w-56 rounded-2xl px-6 py-7 text-xl font-extrabold transition-transform hover:-translate-y-1 ${card.badgeClass}`}
          >
            {card.name}
            <span className="mt-1.5 block text-[13px] font-medium opacity-75">
              {card.blurb}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
