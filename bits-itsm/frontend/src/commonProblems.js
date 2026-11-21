// Common campus IT problem templates grouped by category
export const commonProblemCategories = [
  {
    category: 'Payments',
    problems: [
      'SWD Pay not working',
      'SWD Pay transaction failed',
      'Payment successful but status not updated',
    ],
  },
  {
    category: 'Academic Systems',
    problems: [
      'SLMS not working',
      'LMS not working',
      'ERP not working',
      'Course materials not loading',
    ],
  },
  {
    category: 'Network',
    problems: [
      'F Block Wi-Fi not working',
      'Hostel LAN/Wi-Fi not working',
      'Campus Wi-Fi not connecting',
      'Wi-Fi connected but no internet',
      'Internet frequently disconnecting',
      'Ethernet/LAN port not working',
    ],
  },
  {
    category: 'Accounts and Email',
    problems: [
      'BITS institutional email not working',
      'BITS account login failed',
      'Password reset or account locked',
    ],
  },
  {
    category: 'Software',
    problems: [
      'College software not opening',
      'Other IT problem',
    ],
  },
];

export const allCommonProblems = commonProblemCategories.flatMap((group) => group.problems);
export const standardProblemTitles = allCommonProblems.filter((title) => title !== 'Other IT problem');
