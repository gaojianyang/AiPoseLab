import type { ExerciseBase } from '../types/workout';
import {
  RIGHT_BICEP_CURL_EXERCISE,
  LEFT_BICEP_CURL_EXERCISE,
  BILATERAL_BICEP_CURL_EXERCISE,
} from './bicepCurl';
import { SQUAT_EXERCISE } from './squat';

export const ALL_EXERCISES: ExerciseBase[] = [
  RIGHT_BICEP_CURL_EXERCISE,
  LEFT_BICEP_CURL_EXERCISE,
  BILATERAL_BICEP_CURL_EXERCISE,
  SQUAT_EXERCISE,
];

