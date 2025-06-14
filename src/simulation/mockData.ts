// Mock data for challenge simulation

export const mockUsers = [
  { id: 1, name: 'User 1', interactionLevel: 5 },
  { id: 2, name: 'User 2', interactionLevel: 3 },
  { id: 3, name: 'User 3', interactionLevel: 4 },
  { id: 4, name: 'User 4', interactionLevel: 2 },
  { id: 5, name: 'User 5', interactionLevel: 6 },
];

export const mockChallenges = [
  { id: 1, title: 'Challenge 1', description: 'Description for Challenge 1', activityType: 'Running', objectiveType: 'max_value', goalAmount: 100, durationDays: 7, startDate: '2023-10-01', isOfficial: true, pointsValue: 5 },
  { id: 2, title: 'Challenge 2', description: 'Description for Challenge 2', activityType: 'Cycling', objectiveType: 'daily_minimum', goalAmount: 50, durationDays: 5, startDate: '2023-10-05', isOfficial: false, pointsValue: null },
]; 