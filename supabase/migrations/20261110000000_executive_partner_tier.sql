-- Executive Partner: $3,799 course tier above VIP Inner Circle. Full product catalogue,
-- every pathway step (rank 4 clears every min_tier). Its own file because a new enum
-- value can't be used in the transaction that adds it.
alter type public.tier add value if not exists 'executive';
