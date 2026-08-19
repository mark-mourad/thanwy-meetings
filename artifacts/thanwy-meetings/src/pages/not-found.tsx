import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { ThanwyLogo } from '@/components/thanwy-logo';

export default function NotFound() {
  return (
    <div className="thanwy-grid flex min-h-[100dvh] items-center justify-center bg-background p-6" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <ThanwyLogo className="mx-auto mb-9" />
        <AlertCircle className="mx-auto mb-5 text-accent" size={34} />
        <h1 className="text-3xl font-extrabold">الصفحة غير موجودة</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">يبدو أننا أخذنا منعطفاً غير صحيح. عد إلى مساحتك لنكمل معاً.</p>
        <Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground" data-testid="link-not-found-home">العودة للرئيسية</Link>
      </div>
    </div>
  );
}
