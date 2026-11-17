-- Internal helpers are not part of the public API.
revoke execute on function public.moloko_sync_bonus(uuid), public.moloko_bookings_after(), public.moloko_touch() from authenticated, anon, public;
revoke execute on function public.moloko_client_level(text, uuid) from anon, public;
