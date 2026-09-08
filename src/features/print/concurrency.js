export const runWithConcurrency = async (tasks, limit = 4) => {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  };

  const workerCount = Math.min(Math.max(1, limit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
};
