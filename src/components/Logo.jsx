import { Image } from '@/components/ui/image';

export const LOGO_URL =
  'https://media.base44.com/images/public/6a84b445f638bd5605381437/9a602756f_generated_image.png';

export default function Logo({ boxClassName = 'h-16 w-44', onDark = false }) {
  return (
    <div
      className={`flex items-center justify-center ${onDark ? 'p-0' : 'p-0'} ${boxClassName}`}
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