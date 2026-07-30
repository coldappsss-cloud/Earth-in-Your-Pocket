import colors from '@/constants/colors';

// Earth in Your Pocket is dark-only. Always return the dark palette.
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
