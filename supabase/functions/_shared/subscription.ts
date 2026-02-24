export const toIsoFromUnix = (timestamp?: number | null) =>
  timestamp ? new Date(timestamp * 1000).toISOString() : null;

export const resolveSubscriptionStatus = (subscription: {
  ended_at?: number | null;
  cancel_at_period_end?: boolean | null;
  status?: string | null;
  latest_invoice?: unknown;
}) => {
  if (subscription.ended_at) {
    return 'canceled';
  }

  if (subscription.cancel_at_period_end) {
    return 'canceling';
  }

  if (subscription.status === 'past_due') {
    return 'past_due';
  }

  if (subscription.status === 'trialing' && !subscription.latest_invoice) {
    return 'trial';
  }

  return 'active';
};
