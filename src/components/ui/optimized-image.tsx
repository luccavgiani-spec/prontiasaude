import { ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  className = '',
  ...props
}: OptimizedImageProps) {
  const aspectRatio = `${width}/${height}`;

  // Generate srcset for responsive images
  const generateSrcSet = () => {
    const basePath = src.replace(/\.(jpg|jpeg|png)$/i, '');
    const ext = '.webp';
    
    return `${basePath}-600${ext} 600w, ${basePath}-1200${ext} 1200w`;
  };

  return (
    <img
      src={src}
      srcSet={generateSrcSet()}
      sizes={sizes || '(max-width: 768px) 600px, 1200px'}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      style={{ aspectRatio }}
      className={className}
      {...props}
    />
  );
}
