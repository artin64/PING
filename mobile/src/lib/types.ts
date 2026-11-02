export type User = { id: string; email: string; timezone: string; ai_external_consent: boolean };

export type Capture = {
  id: string;
  title: string;
  kind: 'note' | 'link' | 'screenshot' | 'document';
  body: string;
  extracted_text: string;
  category: string;
  summary: string;
  entities: { name: string; type: string; source_quote: string }[];
  date_suggestions: { date: string; label: string; source_quote: string; confidence: number }[];
  ai_provider: string | null;
  source_url: string | null;
  original_filename: string | null;
  content_type: string | null;
  ocr_status: string;
  status: string;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: string;
  capture_id: string | null;
  trip_id: string | null;
  title: string;
  note: string;
  kind: 'deadline' | 'payment' | 'appointment' | 'trip';
  due_at: string;
  amount: number | null;
  currency: string | null;
  recurrence: 'none' | 'weekly' | 'monthly' | 'yearly';
  recurrence_timezone: string;
  reminder_offsets_minutes: number[];
  payment_state: 'upcoming' | 'due' | 'overdue' | null;
  status: string;
  confirmed_at: string | null;
  completed_at: string | null;
};

export type TripBooking = {
  id: string;
  trip_id: string;
  capture_id: string | null;
  kind: 'flight' | 'hotel' | 'transport' | 'other';
  title: string;
  confirmation_reference: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  departure_timezone: string | null;
  arrival_timezone: string | null;
  from_location: string | null;
  to_location: string | null;
  notes: string;
  created_at: string;
};

export type TripChecklistItem = {
  id: string;
  trip_id: string;
  title: string;
  category: 'documents' | 'booking' | 'packing' | 'preparation' | 'other';
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type Trip = {
  id: string;
  title: string;
  destination: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  notes: string;
  status: string;
  bookings: TripBooking[];
  checklist: TripChecklistItem[];
  created_at: string;
  updated_at: string;
};

export type PaymentHistoryItem = {
  id: string;
  reminder_id: string;
  due_at: string;
  paid_at: string;
  amount: number | null;
  currency: string | null;
};

export type PaymentOverview = {
  month: string;
  upcoming: Reminder[];
  month_paid: { currency: string; amount: number; count: number; amount_count: number }[];
  history: PaymentHistoryItem[];
};

export type Dashboard = {
  today: string;
  needs_attention: Reminder[];
  upcoming: Reminder[];
  upcoming_trips: Trip[];
  recent_captures: Capture[];
};
