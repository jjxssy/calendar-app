import Link from "next/link";

const footerLinks = [
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/cookies", "Cookies"],
  ["/contact", "Contact"],
  ["/about", "About"],
];

export function PublicFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-4 pb-8 pt-4 text-sm font-bold text-[#636366] md:flex-row md:items-center md:justify-between">
      <p>Arcgenda. A free colorful calendar and productivity space.</p>
      <div className="flex flex-wrap gap-2">
        {footerLinks.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full bg-white/60 px-3 py-2 shadow-sm backdrop-blur-xl">
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
