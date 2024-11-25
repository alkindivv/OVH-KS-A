const rateLimit = (fn, delay) => {
  let lastRun = 0;
  return async (...args) => {
    const now = Date.now();
    if (now - lastRun < delay) {
      await new Promise((resolve) =>
        setTimeout(resolve, delay - (now - lastRun))
      );
    }
    lastRun = Date.now();
    return fn(...args);
  };
};
