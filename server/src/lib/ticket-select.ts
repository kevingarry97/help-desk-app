export const TICKET_LIST_SELECT = {
  id: true,
  subject: true,
  requesterEmail: true,
  status: true,
  category: true,
  createdAt: true,
} as const;


export const TICKET_DETAIL_SELECT = {
  ...TICKET_LIST_SELECT,
  body: true,
  updatedAt: true,
} as const;
