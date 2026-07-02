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

  let finalPath = icon;

  // 1. Upgrade old database entries: "./apple.png" -> "/icons/apple.png"
  if (finalPath.startsWith('./') && !finalPath.includes('icons/')) {
    finalPath = finalPath.replace('./', '/icons/'); 
  }
  
  // 2. Fix dot paths from icons.ts: "./icons/apple.png" -> "/icons/apple.png"
  if (finalPath.startsWith('./icons/')) {
    finalPath = finalPath.replace('./icons/', '/icons/');
  }

  // 3. 🚨 THE GITHUB PAGES FIX 🚨
  // Vite automatically provides BASE_URL. 
  // Locally it is '/', on GitHub it is '/Your-Repo-Name/'
  const baseUrl = import.meta.env.BASE_URL;
  
  // If the path starts with '/' but doesn't have the base URL yet, inject it!
  if (finalPath.startsWith('/') && baseUrl !== '/' && !finalPath.startsWith(baseUrl)) {
    finalPath = `${baseUrl}${finalPath.slice(1)}`;
  }

  // Detects if the string is a URL path or file extension
  const isImage = finalPath.startsWith('http') || finalPath.startsWith('/') || finalPath.endsWith('.png') || finalPath.endsWith('.svg') || finalPath.endsWith('.jpg');

  if (isImage) {
    return (
      <img 
        src={finalPath} 
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
        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
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
      {finalPath}
    </span>
  );
}