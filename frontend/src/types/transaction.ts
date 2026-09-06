export interface TransactionCreate {
  listing_id: number;
  message?: string;
}

export interface TransactionResponse {
  transaction_id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed';
  offered_at: string;
  responded_at?: string;
  completed_at?: string;
  message?: string;
}

export interface TransactionUpdate {
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed';
}

export interface TransactionWithListing extends TransactionResponse {
  listing?: {
    title: string;
    price: number;
    images?: string[];
  };
  buyer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  seller?: {
    first_name: string;
    last_name: string;
    email: string;
  };
} 