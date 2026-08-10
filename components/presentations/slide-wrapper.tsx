interface SlideWrapperProps {
  children: React.ReactNode;
}

export function SlideWrapper({ children }: SlideWrapperProps) {
  return (
    <div className="relative flex aspect-video w-full flex-col overflow-hidden bg-neutral-50">
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-primary-500" />

      {/* Decorative dot grid - top right */}
      <div
        className="pointer-events-none absolute right-8 top-8 grid grid-cols-4 gap-[6px] opacity-[0.07]"
        aria-hidden
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="size-[4px] rounded-full bg-neutral-900" />
        ))}
      </div>

      {/* Decorative corner accent - bottom left */}
      <div className="pointer-events-none absolute bottom-8 left-8 opacity-[0.06]" aria-hidden>
        <div className="h-12 w-[2px] bg-neutral-900" />
        <div className="-mt-[2px] h-[2px] w-12 bg-neutral-900" />
      </div>

      {/* Logo */}
      <img
        src="/logo.png"
        alt=""
        className="absolute left-10 top-10 z-10 h-14 w-auto object-contain opacity-70"
      />

      {/* Content area - full height flex column for stacking title + media */}
      <div className="flex min-h-0 flex-1 flex-col px-16 pb-12 pt-20">
        {children}
      </div>
    </div>
  );
}
