// src/components/Icon.tsx
import React from 'react';

interface IconProps {
  icon?: string;
  size?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Icon({ icon, size = '1.2rem', className = '', style = {} }: IconProps) {
  if (!icon) return null;

  // Detects if the string is a URL path or file extension
  const isImage = icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg');

  if (isImage) {
    return (
      <img 
        src={icon} 
        alt="icon" 
        className={className}
        style={{ 
          width: size, 
          height: size, 
          objectFit: 'contain', 
          verticalAlign: 'middle',
          display: 'inline-block',
          ...style
        }} 
      />
    );
  }

  // Otherwise, render as a standard text emoji
  return (
    <span 
      className={className}
      style={{ 
        fontSize: size, 
        lineHeight: 1, 
        verticalAlign: 'middle',
        display: 'inline-block',
        ...style
      }}
    >
      {icon}
    </span>
  );
}