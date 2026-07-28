export const ENDPOINTS = {
  USERS_AUTHENTICATED: 'https://users.roblox.com/v1/users/authenticated',
  USERS_USER: (userId: string) => `https://users.roblox.com/v1/users/${userId}`,
  AUTH_LOGOUT: 'https://auth.roblox.com/v2/logout',
  AUTH_SESSION_REFRESH: 'https://auth.roblox.com/v2/session/refresh',
  AUTH_LOGOUT_ALL: 'https://auth.roblox.com/v2/logoutfromallsessionsandreauthenticate',
  AUTH_PASSWORD_CHANGE: 'https://auth.roblox.com/v1/user/passwords/change',
  ACCOUNT_EMAIL: 'https://accountsettings.roblox.com/v1/email',
  ACCOUNT_COUNTRY: 'https://accountsettings.roblox.com/v1/account/settings/account-country',
  ECONOMY_CURRENCY: (userId: string) => `https://economy.roblox.com/v1/users/${userId}/currency`,
  TRANSACTION_TOTALS: (userId: string) =>
    `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?usedTypes=2228224&timeFrame=Year&transactionType=summary`,
  PARENTAL_CONTROLS: 'https://apis.roblox.com/parental-controls-api/v1/parental-controls/get-linked-parents',
  AVATAR_THUMBNAIL: (userId: string) =>
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
  USER_CONFIGURATION: (userId: string) => `https://www.roblox.com/v1/users/${userId}/configuration`,
  BYPASS_API: 'https://rbx-bypass.com/api/public/bypass',
};