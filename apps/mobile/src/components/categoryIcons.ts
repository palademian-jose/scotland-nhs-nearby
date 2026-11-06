import type { Category } from '../api/types';
import type { IconName } from './ui';

export const CATEGORY_ICONS: Record<Category, IconName> = {
  gp: 'person',
  pharmacy: 'medical',
  dentist: 'happy',
  hospital: 'business',
  ae: 'alert-circle',
};
