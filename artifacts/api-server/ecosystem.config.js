module.exports = {
  apps: [
    {
      name: 'razorbot',
      script: 'pnpm',
      args: 'run start',
      env_file: './.env',   // loads all variables from .env
      env: {
        PORT: 3000,         // optional fallback if .env doesn't have it
      },
    },
  ],
};