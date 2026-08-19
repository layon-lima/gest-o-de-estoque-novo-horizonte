import { Image } from '@/components/ui/image';

export const LOGO_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/becd9704d_TG.png';

export default function Logo({ className = 'h-10', onDark = false }) {
  return (
    <div
      className={`inline-flex items-center rounded-xl ${
        onDark ? 'bg-white/10 p-1.5' : 'bg-white p-1'
      }`}
    >
      <Image
        src={LOGO_URL}
        alt="Fazenda Novo Horizonte"
        className={`${className} w-auto object-contain`}
        fittingType="fit"
      />
    </div>
  );
}