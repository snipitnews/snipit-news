'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface IPhoneVideoMockupProps {
  videoSrc?: string;
  model?: '14' | '14-pro' | '15' | '15-pro';
  color?: 'black' | 'midnight' | 'silver' | 'space-black' | 'titanium';
  className?: string;
}

// Default video source - use Cloudinary URL if available, otherwise local path
// NEXT_PUBLIC_ variables are available in client components in Next.js
const DEFAULT_VIDEO_SRC = 
  process.env.NEXT_PUBLIC_PRODUCT_VIDEO_URL || '/logos/Product Animation.mp4';

const DEVICE_SPECS = {
  '14': {
    w: 390,
    h: 844,
    radius: 56,
    bezel: 12,
    topSafe: 47,
    bottomSafe: 34,
    notch: { w: 225, h: 33, r: 18 },
  },
  '14-pro': {
    w: 393,
    h: 852,
    radius: 56,
    bezel: 12,
    topSafe: 59,
    bottomSafe: 34,
    island: { w: 126, h: 37, r: 20 },
  },
  '15': {
    w: 393,
    h: 852,
    radius: 56,
    bezel: 12,
    topSafe: 59,
    bottomSafe: 34,
    island: { w: 126, h: 37, r: 20 },
  },
  '15-pro': {
    w: 393,
    h: 852,
    radius: 56,
    bezel: 12,
    topSafe: 59,
    bottomSafe: 34,
    island: { w: 126, h: 37, r: 20 },
  },
};

const PRESET_COLORS: Record<string, string> = {
  black: '#0b0b0d',
  midnight: '#0b0c10',
  silver: '#d7d8dc',
  'space-black': '#1c1e22',
  titanium: '#837a72',
};

function shade(hex: string, pct: number): string {
  const h = hex.trim();
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return hex;
  const [r, g, b] = [
    parseInt(m[1], 16),
    parseInt(m[2], 16),
    parseInt(m[3], 16),
  ];
  const k = (100 + pct) / 100;
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${to(r).toString(16).padStart(2, '0')}${to(g)
    .toString(16)
    .padStart(2, '0')}${to(b).toString(16).padStart(2, '0')}`;
}

export const IPhoneVideoMockup: React.FC<IPhoneVideoMockupProps> = ({
  videoSrc = DEFAULT_VIDEO_SRC,
  model = '15-pro',
  color = 'space-black',
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && videoRef.current && !hasStartedRef.current) {
          // Video is in view and hasn't started yet - start playing
          videoRef.current.play().catch((error) => {
            console.warn('Video autoplay failed:', error);
            // Try again after a short delay (sometimes needed for mobile)
            setTimeout(() => {
              if (videoRef.current && !hasStartedRef.current) {
                videoRef.current.play().catch(() => {
                  // Autoplay still failed, user may need to interact
                });
              }
            }, 100);
          });
          hasStartedRef.current = true;
        }
      },
      { 
        threshold: 0.1, // Lower threshold to trigger earlier
        rootMargin: '50px' // Start playing slightly before fully in view
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Ensure video keeps playing once started (handles page visibility changes)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Handle cases where video might stop when page becomes hidden/visible
    const handleVisibilityChange = () => {
      if (!document.hidden && hasStartedRef.current && video.paused && !video.ended) {
        // Page became visible again and video should be playing
        video.play().catch(() => {
          // Resume failed
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const spec = DEVICE_SPECS[model];
  const W = spec.w;
  const H = spec.h;

  const resolvedRadius = spec.radius;
  const resolvedBezel = spec.bezel;

  const screenWidth = W;
  const screenHeight = H;

  const outerWidth = screenWidth + resolvedBezel * 2;
  const outerHeight = screenHeight + resolvedBezel * 2;
  const outerRadius = resolvedRadius + resolvedBezel;

  const colorHex = PRESET_COLORS[color] ?? color;
  const frameGradient = `linear-gradient(135deg, ${shade(
    colorHex,
    8
  )} 0%, ${colorHex} 40%, ${shade(colorHex, -14)} 100%)`;

  const useIsland = Boolean('island' in spec && spec.island);
  const useNotch = Boolean('notch' in spec && spec.notch) && !useIsland;

  const finalIslandW = 'island' in spec ? spec.island?.w ?? 0 : 0;
  const finalIslandH = 'island' in spec ? spec.island?.h ?? 0 : 0;
  const finalIslandR = 'island' in spec ? spec.island?.r ?? 0 : 0;

  const finalNotchW = 'notch' in spec ? spec.notch?.w ?? 0 : 0;
  const finalNotchH = 'notch' in spec ? spec.notch?.h ?? 0 : 0;
  const finalNotchR = 'notch' in spec ? spec.notch?.r ?? 0 : 0;

  return (
    <motion.div
      ref={containerRef}
      className={cn('inline-block', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div
        style={{
          width: outerWidth,
          height: outerHeight,
          borderRadius: outerRadius,
          background: frameGradient,
          padding: resolvedBezel,
          boxShadow:
            '0 12px 30px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.22)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: resolvedRadius,
            position: 'relative',
            overflow: 'hidden',
            background: '#000',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.03), inset 0 10px 20px rgba(0,0,0,0.35), inset 0 -8px 16px rgba(0,0,0,0.28)',
          }}
        >
          {/* Video - portrait orientation */}
          <video
            ref={videoRef}
            src={videoSrc}
            loop
            muted
            playsInline
            autoPlay={false}
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectFit: 'cover' }}
          />

          {/* Dynamic Island */}
          {useIsland && finalIslandW > 0 && finalIslandH > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                width: finalIslandW,
                height: finalIslandH,
                borderRadius: finalIslandR,
                background: '#000',
                zIndex: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.7)',
              }}
            />
          )}

          {/* Notch */}
          {!useIsland && useNotch && finalNotchW > 0 && finalNotchH > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: finalNotchW,
                height: finalNotchH,
                borderRadius: finalNotchR,
                background: '#000',
                zIndex: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.7)',
              }}
            />
          )}

          {/* Home Indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: Math.round(screenWidth * 0.34),
              maxWidth: 140,
              height: 5,
              borderRadius: 3,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.35))',
              opacity: 0.9,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};

