// Business code asks a Clock for the time instead of calling Date.now(), so tests can
// pin "today" (docs/10-testing/TESTING_STRATEGY.md § Clock injection).

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
