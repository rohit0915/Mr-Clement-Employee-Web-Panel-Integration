
export interface CreateSupportTicketPayload {
  email: string;
  businessName: string;
  subject: string;
  message: string;
  images?: File[];
}

export interface SupportTicketResponse {
  ticketNumber: string;
  createdAt: string;
}

export interface SupportTicket {
  ticketNumber: string;
  status: 'all' | 'ongoing' | 'resolved';
  subject: string;
  message: string;
  businessName: string;
  postedAt: string;
  avatar: string;
}

export async function createSupportTicket(
  payload: CreateSupportTicketPayload
): Promise<SupportTicketResponse> {
  console.log(payload)
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  // In real scenario, use:
  // const { data } = await api.post('/support/ticket', payload);
  // return data;
  return {
    ticketNumber: '2023-CS' + Math.floor(Math.random() * 1000 + 100),
    createdAt: new Date().toISOString(),
  };
}

export async function getSupportTicketId(): Promise<string> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  // In real scenario, use:
  // const { data } = await api.get('/support/ticket-id');
  // return data.ticketId;
  return '2023-CS' + Math.floor(Math.random() * 1000 + 100);
}

export async function fetchSupportTickets(filter: 'all' | 'ongoing' | 'resolved' = 'all',
  //  period: 'week' | 'day' | 'month' = 'week',
    search: string = ''): Promise<SupportTicket[]> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  // In real scenario, use:
  // const { data } = await api.get('/support/tickets', { params: { filter, period, search } });
  // return data;
  const now = new Date();
  const postedAt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const allTickets: SupportTicket[] = [
    {
      ticketNumber: '2023-CS123',
      status: 'ongoing',
      subject: 'I need help accessing my account',
      message: 'I cannot access my account. Please help me reset my password.',
      businessName: 'Chinese Cuisine Restaurant',
      postedAt,
      avatar: '/assets/profile/user.svg',
    },
    {
      ticketNumber: '2023-CS124',
      status: 'resolved',
      subject: 'Unable to add new employee',
      message: 'I cannot add new employee and I am not able to watch employee performance as well.',
      businessName: 'ABC Restaurant',
      postedAt,
      avatar: '/assets/profile/user.svg',
    },
    {
      ticketNumber: '2023-CS125',
      status: 'ongoing',
      subject: 'Payment not reflecting',
      message: 'Payment made by customer is not reflecting in the dashboard.',
      businessName: 'XYZ Bar',
      postedAt,
      avatar: '/assets/profile/user.svg',
    },
    {
      ticketNumber: '2023-CS126',
      status: 'resolved',
      subject: 'App crash on login',
      message: 'The app crashes every time I try to login with my credentials.',
      businessName: 'Pasta Palace',
      postedAt,
      avatar: '/assets/profile/user.svg',
    },
    {
      ticketNumber: '2023-CS127',
      status: 'ongoing',
      subject: 'Menu not updating',
      message: 'Changes to the menu are not being saved.',
      businessName: 'Burger House',
      postedAt,
      avatar: '/assets/profile/user.svg',
    },
    {
      ticketNumber: '2023-CS128',
      status: 'resolved',
      subject: 'Order history missing',
      message: 'Order history for last week is missing from the reports.',
      businessName: 'Sushi Central',
      postedAt,
      avatar: '/assets/profile/user.svg',
    },
  ];
  let filtered = allTickets;
  if (filter !== 'all') {
    filtered = allTickets.filter(t => t.status === filter);
  }
  if (search) {
    filtered = filtered.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase()));
  }
  return filtered;
} 