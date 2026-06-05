// MessCast Design System — Glassmorphic Dark Neon
// All colors, spacing, and radius values. Never hardcode hex strings elsewhere.

export const Colors = {
  // Background layers
  bgBase:     '#0A0A0F',
  bgLayer1:   '#0F0F1A',
  bgLayer2:   '#13131F',

  // Glass surfaces
  glassBg:     'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHover:  'rgba(255,255,255,0.07)',

  // Accent colors
  primary:       '#7C5CFC',
  primaryGlow:   'rgba(124,92,252,0.3)',
  primaryDark:   '#5B3FD9',
  secondary:     '#00D4FF',
  secondaryGlow: 'rgba(0,212,255,0.2)',
  success:       '#00E5A0',
  warning:       '#FFB547',
  error:         '#FF4D6A',

  // Bubble colors
  sentBubbleStart:    '#7C5CFC',
  sentBubbleEnd:      '#5B3FD9',
  receivedBubbleBg:   'rgba(255,255,255,0.06)',
  receivedBubbleBorder: 'rgba(255,255,255,0.1)',

  // Text
  textPrimary:   '#F0F0FF',
  textSecondary: 'rgba(240,240,255,0.55)',
  textTertiary:  'rgba(240,240,255,0.3)',

  // UI elements
  separator:  'rgba(255,255,255,0.05)',
  avatarRing: '#7C5CFC',
  onlineDot:  '#00E5A0',
  tabBarBg:   'rgba(10,10,15,0.9)',
  headerBg:   'rgba(10,10,15,0.85)',
  inputBg:    'rgba(255,255,255,0.05)',
  inputFocus: 'rgba(124,92,252,0.4)',
  pinIcon:    '#7C5CFC',
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

export const Radius = {
  xs:  6,
  sm:  10,
  md:  14,
  lg:  20,
  xl:  28,
  full: 999,
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  hero: 32,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
};

export const Shadow = {
  neonPrimary: {
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  neonSecondary: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const GlassStyle = {
  backgroundColor: Colors.glassBg,
  borderWidth: 1,
  borderColor: Colors.glassBorder,
  borderRadius: Radius.lg,
} as const;
