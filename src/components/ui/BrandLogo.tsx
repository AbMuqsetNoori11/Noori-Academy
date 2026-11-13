import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/mediaAssets';

interface BrandLogoProps {
  logoUrl?: string | null;
  alt?: string;
  sizeClass?: string;
  iconClass?: string;
  roundedClass?: string;
  bgClass?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoUrl,
  alt = 'Danesh Academy Logo',
  sizeClass = 'w-9 h-9',
  iconClass = 'w-5 h-5',
  roundedClass = 'rounded-lg',
  bgClass = 'bg-blue-700 text-white',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const resolved = logoUrl ? resolveMediaUrl(logoUrl) : '';

  if (resolved && !imgFailed) {
    return (
      <div className={`${sizeClass} ${roundedClass} overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0`}>
        <img
          src={resolved}
          alt={alt}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain p-0.5"
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} ${roundedClass} ${bgClass} flex items-center justify-center shrink-0`}>
      <GraduationCap className={iconClass} />
    </div>
  );
};
