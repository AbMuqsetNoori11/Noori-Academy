import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../utils/mediaAssets';

interface UserAvatarProps {
  photoUrl?: string | null;
  name: string;
  sizeClass?: string;
  textClass?: string;
  roundedClass?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  name,
  sizeClass = 'w-9 h-9',
  textClass = 'text-xs',
  roundedClass = 'rounded-full',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const resolved = photoUrl ? resolveMediaUrl(photoUrl) : '';
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
    : (parts[0]?.slice(0, 2) || 'U').toUpperCase();

  if (resolved && !imgFailed) {
    return (
      <img
        src={resolved}
        alt={name}
        onError={() => setImgFailed(true)}
        className={`${sizeClass} ${roundedClass} object-cover border border-slate-200 bg-white shrink-0`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} ${roundedClass} bg-blue-100 text-blue-800 border border-blue-200 font-display font-bold flex items-center justify-center shrink-0 ${textClass}`}
    >
      {initials}
    </div>
  );
};
