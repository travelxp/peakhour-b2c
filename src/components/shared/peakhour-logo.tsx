import Image from "next/image";

export function PeakhourLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <>
      <Image
        src="/logo-black.svg"
        alt="Peakhour"
        width={130}
        height={32}
        className={`${className} block dark:hidden`}
        priority
        unoptimized
      />
      <Image
        src="/logo-white.svg"
        alt="Peakhour"
        width={130}
        height={32}
        className={`${className} hidden dark:block`}
        unoptimized
      />
    </>
  );
}
