import Image from "next/image";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  label?: boolean;
  className?: string;
};

const sizes = {
  sm: "size-9",
  md: "size-12",
  lg: "size-16",
  xl: "size-24",
};

const pixels = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
};

export function BrandMark({ size = "md", label = false, className = "" }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className={`${sizes[size]} relative shrink-0 overflow-hidden rounded-[28%] shadow-lg shadow-[#7c3aed]/20`}>
        <Image
          src="/icons/arcgenda-icon.png"
          alt="Arcgenda logo"
          width={pixels[size]}
          height={pixels[size]}
          className="h-full w-full object-contain"
          draggable={false}
          priority={size === "lg" || size === "xl"}
        />
      </span>
      {label && <span className="text-lg font-black tracking-normal text-[#18181b]">Arcgenda</span>}
    </span>
  );
}
