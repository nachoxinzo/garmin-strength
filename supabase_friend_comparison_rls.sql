-- IronSync: Lectura segura de workout_logs entre amigos aceptados para la Comparativa Cara a Cara
-- Ejecutar en Supabase SQL Editor (proyecto vshyanpqkniwirkvmpzn)
-- Idempotente y compatible con RLS estricta (mantiene workout_logs_owner_only para escrituras).

DROP POLICY IF EXISTS workout_logs_friends_select ON public.workout_logs;

CREATE POLICY workout_logs_friends_select
  ON public.workout_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.sender_id = auth.uid() AND f.receiver_id = workout_logs.user_id)
          OR (f.receiver_id = auth.uid() AND f.sender_id = workout_logs.user_id)
        )
    )
  );
