// Runs once before Jest starts workers; they inherit this env (TESTING_STRATEGY.md § Timezone).
module.exports = async () => {
  process.env.TZ = 'Asia/Kolkata';
};
