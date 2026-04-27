import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard Tailwind class merger
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
