export type TicketCategory = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    tickets: number;
  };
};

export type CreateTicketCategoryInput = {
  name: string;
};

export type UpdateTicketCategoryInput = Partial<CreateTicketCategoryInput>;

export type DeleteTicketCategoryResponse = {
  id: number;
  detachedTickets: number;
};
