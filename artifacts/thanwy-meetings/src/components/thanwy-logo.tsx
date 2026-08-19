import logoPath from '@assets/WhatsApp_Image_2026-08-17_at_12.46.29_PM-removebg-preview_1787096927939.png';

type ThanwyLogoProps = {
  compact?: boolean;
  className?: string;
};

export function ThanwyLogo({ compact = false, className = '' }: ThanwyLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} dir="ltr" data-testid="brand-thanwy">
      <img
        src={logoPath}
        alt="Thanwy Meetings"
        className={compact ? 'h-10 w-10 object-contain' : 'h-12 w-12 object-contain'}
        data-testid="img-thanwy-logo"
      />
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-extrabold tracking-[.16em] text-foreground">THANWY</div>
          <div className="mt-1 text-[10px] font-semibold tracking-[.24em] text-primary">MEETINGS</div>
        </div>
      )}
    </div>
  );
}