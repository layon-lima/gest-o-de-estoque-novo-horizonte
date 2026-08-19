import { Image } from '@/components/ui/image';

export const LOGO_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/becd9704d_TG.png';

export default function Logo({ boxClassName = 'h-14 w-full', onDark = false }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl p-1 ${
        onDark ? 'bg-white/10' : 'bg-white'
      } ${boxClassName}`}
    >
      <Image
        src={LOGO_URL}
        alt="Fazenda Novo Horizonte"
        className="h-full w-full"
        fittingType="fit"
      />
    </div>
  );
}