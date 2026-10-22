// All user-facing text lives here (NFR-15). Reference copy: docs/07-content/UI_COPY.md.

export const strings = {
  tab: {
    home: 'Home',
    transactions: 'Transactions',
    udhaar: 'Udhaar',
    reports: 'Reports',
    more: 'More',
  },
  placeholder: {
    title: 'Coming soon',
    home: 'Your monthly summary and quick add will appear here.',
    transactions: 'Your income and expenses will show here.',
    udhaar: 'Keep track of money you give to or take from friends.',
    reports: 'Weekly and monthly reports will appear here.',
    more: 'Settings, backup, and categories will live here.',
  },
  common: {
    loading: 'Loading',
    tryAgain: 'Try again',
  },
  startup: {
    loading: 'Opening your data…',
    errorTitle: "Hisaab couldn't start",
    errorMessage: 'Something went wrong while opening your data. Nothing was deleted.',
    dbNewerTitle: 'Please update Hisaab',
    dbNewerMessage:
      'This data was created by a newer version of Hisaab. Please install the latest version.',
    shareDiagnostics: 'Share diagnostic info',
  },
} as const;
