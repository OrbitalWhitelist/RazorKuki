module.exports = {
  apps: [
    {
      name: 'razorbot',
      script: 'pnpm',
      args: 'run start',
      env_file: './.env',
      env: {
        PORT: 3000,
      },
    },
  ],
};