// Print this week's training exactly as get_training_week returns it: node src/preview.ts [--demo]
import { loadConfig } from './config.ts';
import { createTrainingContext } from './context.ts';
import { getTrainingWeek } from './queries.ts';

try {
  const week = await getTrainingWeek(createTrainingContext(loadConfig()));
  console.log(JSON.stringify(week, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
