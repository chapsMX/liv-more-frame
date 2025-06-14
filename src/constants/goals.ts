export const MIN_GOALS = {
  CALORIES: 1750,
  STEPS: 5500,
  SLEEP: 7
} as const;

export const validateGoals = (goals: { calories: number; steps: number; sleep: number }) => {
  return {
    isValid: 
      goals.calories >= MIN_GOALS.CALORIES &&
      goals.steps >= MIN_GOALS.STEPS &&
      goals.sleep >= MIN_GOALS.SLEEP,
    invalidFields: {
      calories: goals.calories < MIN_GOALS.CALORIES,
      steps: goals.steps < MIN_GOALS.STEPS,
      sleep: goals.sleep < MIN_GOALS.SLEEP
    }
  };
}; 